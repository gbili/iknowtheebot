import { isMention, isTextMention } from '../commonTypes';
import { unmerge } from 'swiss-army-knifey';
import { Message, MessageEntity, Update, User } from 'telegraf/typings/core/types/typegram';
import { BotServiceModels, BotServiceUserModel, ContactNameMentionnedUser, DBUser, GetChatMemberProp, isUsernameMention, MentionnedUser, UsernameMentionnedUser, UUID } from '../types';
import { Telegraf } from 'telegraf/typings/telegraf';
import { NarrowedContext, Context } from 'telegraf';

type HasFirstName = { username?: string | null; first_name: string; };
type HasUsername =  { username: string; first_name?: string | null; };
type OneOrTheOther = HasFirstName | HasUsername;
export function isHasUsername(u: OneOrTheOther): u is HasUsername {
  return typeof u.username === 'string';
}
export function userToName(user: OneOrTheOther): string {
  return isHasUsername(user)
    ? `@${user.username}`
    : user.first_name;
}

export function isSameUsernameUser(u: { username?: string | null }, v: { username?: string | null }) {
  return typeof u.username === 'string'
    && typeof v.username === 'string'
    && u.username === v.username;
}

export function isSameContactNameUser(u: { id?: number | null }, v: { id?: number | null }) {
  return Boolean(u.id && v.id && u.id === v.id)
}

export const isSameUser = (a: DBUser|MentionnedUser) => (b: DBUser|MentionnedUser) => (isSameUsernameUser(a, b) || isSameContactNameUser(a, b));

export const getMemberById = (telegram: GetChatMemberProp) => async function (chatId: number, userId: number) {
  try {
    return await telegram.getChatMember(chatId, userId);
  } catch (err) {
    console.log(`Error trying to getMemberById chatId: ${chatId} userId: ${userId}. Error: `, err);
  }
  return null;
}

export async function getPosterFromName(telegram: GetChatMemberProp, chatId: number, fromId: number) {
  const response = await (getMemberById(telegram)(chatId, fromId));
  // does the response.user.id appear in the "validated users" global message
  const fromName = (response && userToName(response.user)) || ':unknown:';
  return fromName;
}

export const handleVouchPathAndVouchersOf = (models: BotServiceModels, getUUIDsMethod: (watchedMentions: DBUser) => Promise<UUID[]>, getOutcomeMessage: (mentionnedUsers: (User|UsernameMentionnedUser)[], vouchers: DBUser[]) => string) => async (ctx: NarrowedContext<Context<Update>, {
    message: Update.New & Update.NonChannel & Message.TextMessage;
    update_id: number;
  }>) => {
  console.log(`------------ vouchersOf:ctx`);
  console.log(ctx)
  const { update } = ctx;
  const { byContactName, byUsername } = getMentionnedUsers(update);
  const mentionnedUsers = [...byContactName, ...byUsername];

  console.log('mentionnedUsers', mentionnedUsers);

  const watchedMentionnedUsers = await models.UserModel.getUsers(byContactName, byUsername);

  if ((mentionnedUsers.length > 0 || mentionnedUsers.length <= 1) && watchedMentionnedUsers.length <= 0) {
    ctx.telegram.sendMessage(ctx.chat.id, `${userToName(mentionnedUsers[0])} has no vouchers, and has not been /greeted so far. I'll do it now.`, {});
    ctx.telegram.sendMessage(ctx.chat.id, `/greet ${userToName(mentionnedUsers[0])}`, {});
    return;
  }

  const vouchersUUIDs = mentionnedUsers.length <= 0 || mentionnedUsers.length > 1
    ? []
    : await getUUIDsMethod(watchedMentionnedUsers[0]);

  const byBreadcumbPosition = (a: DBUser, b: DBUser) => vouchersUUIDs.indexOf(a.UUID) - vouchersUUIDs.indexOf(b.UUID);
  const vouchers = (await models.UserModel.getUsersByUUID(vouchersUUIDs)).sort(byBreadcumbPosition);

  ctx.telegram.sendMessage(
    ctx.chat.id,
    getOutcomeMessage(mentionnedUsers, vouchers),
    {}
  );
}

export const outcomeMessageGen = (commandName: string, intro: string, outtro: string = '', sep: string = ', ') => (mentionnedUsers: (User|UsernameMentionnedUser)[], vouchers: DBUser[]) => {
  return mentionnedUsers.length <= 0 || mentionnedUsers.length > 1
    ? `Please specify one user as in /${commandName} \\@user`
    : `${intro} ${userToName(mentionnedUsers[0])}${outtro}: \n ${
      vouchers.length > 0
        ? vouchers.map(userToName).join(sep)
        : "As far as I can tell it's an intruder"
    }`
}

export async function handleVouchUnvouch(bot: Telegraf, models: BotServiceModels, update: UpdateInCommand, command: 'vouch'|'unvouch') {
  const { message: { from, chat } } = update;

  const { byContactName, byUsername } = getMentionnedUsers(update);
  const vouchedUsers = [...byContactName, ...byUsername]
  const fromName = await getPosterFromName(bot.telegram, chat.id, from.id);

  const voucher = await models.UserModel.saveUserGetUUID({ byContactName: from });
  const voucheesByContactName = await Promise.all(byContactName.map(vouchee => models.UserModel.saveUserGetUUID({ byContactName: vouchee })));
  const voucheesByUsername = await Promise.all(byUsername.map(vouchee => models.UserModel.saveUserGetUUID({ byUsername: vouchee })));

  if (command === 'vouch') {
    await Promise.all([...voucheesByContactName, ...voucheesByUsername].map(vouchee => models.graphUserModel.saveVouch(voucher, vouchee)));
  } else {
    await Promise.all([...voucheesByContactName, ...voucheesByUsername].map(vouchee => models.graphUserModel.saveUnvouch(voucher, vouchee)));
  }

  bot.telegram.sendMessage(chat.id, vouchedUsers.length
    ? `Thank you ${fromName}, you have ${command}ed for ${vouchedUsers.map(userToName).join(', ')}`
    : `Hey ${fromName}, I did not understand who you were vouching for.`, {
  });

}

export type UpdateInCommand = {
  message: Update.New & Update.NonChannel & Message.TextMessage;
  update_id: number;
}

export const watchMembers = async (UserModel: BotServiceUserModel, members: DBUser[], usersToWatch: MentionnedUser[], overwrite: boolean): Promise<[DBUser[], MentionnedUser[]]> => {
  const [mentionnedMembers, ] = unmerge(members, dbUser => usersToWatch.filter(isSameUser(dbUser)).length > 0);
  const [overwrittenMentionnedMembers, newMembers] = unmerge(usersToWatch, aclUser => mentionnedMembers.filter(isSameUser(aclUser)).length > 0);
  const membersToSave = overwrite
    ? [...overwrittenMentionnedMembers, ...newMembers]
    : [...newMembers];

  const [byUsername, byContactName] = unmerge(membersToSave, isUsernameMention) as [UsernameMentionnedUser[], User[]];

  await Promise.all([
    ...byUsername.map(member => UserModel.saveUserGetUUID({ byUsername: member })),
    ...byContactName.map(member => UserModel.saveUserGetUUID({ byContactName: member })),
  ]);

  return [mentionnedMembers, newMembers];
}

export default function getMentionnedUsers(update: UpdateInCommand) {
  const { message: { entities, text } } = update;

  if (undefined === entities) {
    console.log('Need to have an entity mentionned');
    return {
      byUsername: [],
      byContactName: [],
    };
  }

  console.log('entities', entities);

  const bothMentions = entities
    .filter(entity => isMention(entity) || isTextMention(entity))
  const [textMentions, mentions] = unmerge(bothMentions, isTextMention);

  const byContactName = (textMentions as MessageEntity.TextMentionMessageEntity[]).map(function (entity) {
      const u: ContactNameMentionnedUser = {
        ...entity.user,
      };
      return u;
  });

  const byUsername = (mentions as MessageEntity.CommonMessageEntity[]).map(function (entity) {
      const { offset, length } = entity;
      const offsetWithoutAtSymbol = offset+1;
      const lengthMinusAtSymbol = length-1;
      const usernameWithoutAtSymbol = text.substring(offsetWithoutAtSymbol, offsetWithoutAtSymbol+lengthMinusAtSymbol);
      const u: UsernameMentionnedUser = {
        username: usernameWithoutAtSymbol,
      };
      return u;
    })
    .filter((s: User | { username: string; }) => s.hasOwnProperty('id') || (s.username && s.username !== ''));

  console.log('byUsername', byUsername);
  console.log('byContactName', byContactName);

  return {
    byContactName,
    byUsername
  };
}

export type ReductionForInfoData = { result: DBUser; unaltered: boolean; };

export function keepMostInfo(a: DBUser, b: Partial<User>): ReductionForInfoData {
  const res = (Object.keys(a) as (keyof DBUser)[]).reduce((prev: ReductionForInfoData, k) => {
    const p = prev.result;
    if (k === 'UUID' || p[k] !== null) {
      return prev;
    }
    return {
      result: {
        ...p,
        [k]: typeof b[k] !== 'undefined' ? b[k] : null,
      },
      unaltered: false,
    };
  }, { result: a, unaltered: true, });
  return res;
}
