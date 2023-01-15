import { isMention, isTextMention } from '../commonTypes';
import { unmerge } from 'swiss-army-knifey';
import { Message, MessageEntity, Update, User } from 'telegraf/typings/core/types/typegram';
import { BotServiceModels, ContactNameMentionnedUser, DBUser, DBUserWithStatus, GetChatMemberProp, isUsernameMention, MentionnedUser, UsernameMentionnedUser, UUID } from '../types';
import { NarrowedContext, Context, Telegram } from 'telegraf';

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

export const getChatRootNodes = async (
  {
    bot,
    models: { UserModel, graphUserModel },
    chatId,
    botId
  }: {
    bot: Telegram;
    models: BotServiceModels;
    chatId: number;
    botId: number;
  },
  considerAdminsRoot: boolean
): Promise<DBUserWithStatus[]>  => {
  const admins = (await bot.getChatAdministrators(chatId));
  const dbAdmins = await UserModel.saveChatAdministrators(admins, chatId, botId);
  graphUserModel.saveUsers(dbAdmins, chatId);
  return considerAdminsRoot
    ? dbAdmins
    : dbAdmins.filter(u => u.status === 'creator');
}


export async function getPosterFromName(telegram: GetChatMemberProp, chatId: number, fromId: number) {
  const response = await (getMemberById(telegram)(chatId, fromId));
  // does the response.user.id appear in the "validated users" global message
  const fromName = (response && userToName(response.user)) || ':unknown:';
  return fromName;
}

export const fetchAndSaveAdmins = async (
  {
    bot,
    models,
    chatId,
    botId
  }: {
    bot: Telegram;
    models: BotServiceModels;
    chatId: number;
    botId: number;
  },
  greet: boolean
) => {
  const chatAdmins = await getChatRootNodes({ bot, models, chatId, botId }, true);
  if (greet) await bot.sendMessage(chatId, `Dear admins: ${commaSepExceptForLastOne(chatAdmins.map(userToName))}, I'm now up and running. You can start vouching for people right away. Check the manual with the /help command.`);
}


export const handleVouchPathAndVouchersOf = (
  models: BotServiceModels,
  getUUIDsMethod: (watchedMentions: DBUser, chatId: number) => Promise<UUID[]>,
  getOutcomeMessage: (mentionnedUsers: (User|UsernameMentionnedUser)[], vouchers: DBUser[]) => string
) => async (
  ctx: NarrowedContext<Context<Update>, { message: Update.New & Update.NonChannel & Message.TextMessage; update_id: number; }>
) => {
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
    : await getUUIDsMethod(watchedMentionnedUsers[0], ctx.chat.id);

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

export async function handleVouchUnvouch(bot: Telegram, models: BotServiceModels, update: UpdateInCommand, command: 'vouch'|'unvouch') {
  const { message: { from, chat } } = update;

  const { byContactName, byUsername } = getMentionnedUsers(update);
  const vouchedUsers = [...byContactName, ...byUsername]
  const fromName = await getPosterFromName(bot, chat.id, from.id);

  const voucher = await models.UserModel.saveGetDBUser({ byContactName: from });
  const voucheesByContactName = await Promise.all(byContactName.map(vouchee => models.UserModel.saveGetDBUser({ byContactName: vouchee })));
  const voucheesByUsername = await Promise.all(byUsername.map(vouchee => models.UserModel.saveGetDBUser({ byUsername: vouchee })));

  if (command === 'vouch') {
    await Promise.all([...voucheesByContactName, ...voucheesByUsername].map(vouchee => models.graphUserModel.saveChatVouch(voucher, vouchee, chat.id)));
  } else {
    await Promise.all([...voucheesByContactName, ...voucheesByUsername].map(vouchee => models.graphUserModel.saveChatUnvouch(voucher, vouchee, chat.id)));
  }

  bot.sendMessage(chat.id, vouchedUsers.length
    ? `Thank you ${fromName}, you have ${command}ed ${command === 'vouch' ? 'for ' : ''}${vouchedUsers.map(userToName).join(', ')}`
    : `Hey ${fromName}, I did not understand who you were vouching for.`, {
  });

}

export type UpdateInCommand = {
  message: Update.New & Update.NonChannel & Message.TextMessage;
  update_id: number;
}

export const watchMembersBis = async ({ UserModel, graphUserModel }: BotServiceModels, usersToWatch: MentionnedUser[], chatId: number): Promise<DBUser[]> => {
  const [byUsername, byContactName] = unmerge(usersToWatch, isUsernameMention) as [UsernameMentionnedUser[], User[]];

  const dbUsers = await Promise.all([
    ...byUsername.map(member => UserModel.saveGetDBUser({ byUsername: member })),
    ...byContactName.map(member => UserModel.saveGetDBUser({ byContactName: member })),
  ]);

  await graphUserModel.saveUsers(dbUsers, chatId);

  return dbUsers;
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

export function commaSepExceptForLastOne(people: string[]) {
  const [lastOne, ...rest] = people;
  return people.length <= 0 ? '' : people.length <= 1 ? lastOne : `${rest.join(', ')} and ${lastOne}`;
}