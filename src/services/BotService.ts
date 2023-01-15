import { reduceWithBreak, unmerge } from 'swiss-army-knifey';
import { Telegraf } from 'telegraf/typings/telegraf';
import { BotServiceInterface, BotServiceModels, BotServiceUserModel, CommandHandlerProps, DBUser, GraphUserModel, MentionnedUser, UUID } from '../types';
import getMentionnedUsers, { handleVouchUnvouch, isSameUser, userToName, handleVouchPathAndVouchersOf, outcomeMessageGen, watchMembersBis, commaSepExceptForLastOne, fetchAndSaveAdmins, getChatRootNodes } from '../utils/mentionnedUsers';


class BotService implements BotServiceInterface {

  private bot: Telegraf;
  private botId: number;
  private models: BotServiceModels;
  private considerAdminsRoot: boolean;

  public constructor(props: {
    bot: Telegraf;
    models: { UserModel: BotServiceUserModel; graphUserModel: GraphUserModel; };
    botId: number;
    considerAdminsRoot: boolean;
  }) {
    this.bot = props.bot;
    this.models = props.models;
    this.botId = props.botId;
    this.considerAdminsRoot = props.considerAdminsRoot;

    this.bot.command('start', async ctx => {
      await fetchAndSaveAdmins({ bot: ctx.telegram, models: this.models, chatId: ctx.chat.id, botId: this.botId }, true);
    });

    this.bot.command('help', ctx => {
      ctx.telegram.sendMessage(ctx.chat.id, `
      # I Know Thee Bot v0.0.1

      Use any of the following commands:
        /start
          -> Initialized the bot

        /greet @user
          -> Make the bot aware of a user (the bot api does not give access a group's members list, so you need to manually add existing members)
        /greeted
          -> Check who's the bot is aware of
        /intruders
          -> Get the list of intruders (among those I have already greeted)
        /vouchersOf @user
          -> Check who vouched for user (/vouchers @user)
        /vouchFor @user
          -> Vouch for a user (/vouch @user)
        /vouchPath @user
          -> Check how a user is connected to the admins
        /unvouch @user
          -> Remove your vouch for user

        /help
          -> This help

        Keep a vibrant community of people who know each other. Public groups get often plagued by intruders who end up spamming their members. To prevent that, I memorize who's vouched for who. As long as you have a link to the admins of the group (even an indirect one), you are considered genuine. When no one has vouched for a member, he is considered an intruder.

        🪲 bugs to @gbili
        `, {}
      );
    });

    const vouchHandler = async ({ update, telegram }: CommandHandlerProps) => {
      await handleVouchUnvouch(telegram, this.models, update, 'vouch');
    };
    this.bot.command('vouch', vouchHandler);
    this.bot.command('vouchFor', vouchHandler);

    this.bot.command('unvouch', async ({ update, telegram }) => {
      await handleVouchUnvouch(telegram, this.models, update, 'unvouch');
    });

    this.bot.command('vouchPath', handleVouchPathAndVouchersOf(
      this.models,
      async (watchedMentionnedUser: DBUser, chatId: number) => {
        const chatRootNodes = await getChatRootNodes(
          {
            bot: this.bot.telegram,
            models: this.models,
            chatId: chatId,
            botId: this.botId
          },
          this.considerAdminsRoot
        );

        const foundAPath = (acc: UUID[], curr: DBUser) => acc.length > 0;
        const shortestPath = await reduceWithBreak(
          chatRootNodes,
          async (acc: UUID[], currAdmin) => {
            return await this.models.graphUserModel.getChatShortestPath(currAdmin, watchedMentionnedUser, chatId);
          },
          foundAPath,
          []
        );
        return shortestPath;
      },
      outcomeMessageGen(
        'vouchPath',
        "Here's the link between",
        ' and the group owner',
        ' -> '
      )
    ));

    this.bot.command('vouchersOf', handleVouchPathAndVouchersOf(
      this.models,
      async (watchedMentionnedUser: DBUser, chatId: number) => {
        return await this.models.graphUserModel.getChatImmediateVouchersUUIDs(watchedMentionnedUser, chatId)
      },
      outcomeMessageGen(
        'vouchersOf',
        "Here's who vouched for",
        '',
        ', '
      )
    ));

    this.bot.command('intruders', async ctx => {
      const chatRootNodes = await getChatRootNodes({ bot: ctx.telegram, models: this.models, chatId: ctx.chat.id, botId: this.botId }, this.considerAdminsRoot);
      const intrudersUUIDs = await this.models.graphUserModel.getChatIntruders({ UUIDs: chatRootNodes.map(n => n.UUID) }, ctx.chat.id);
      const intruders = await this.models.UserModel.getUsersByUUID(intrudersUUIDs);

      const isSender = isSameUser(ctx.message.from);
      const isNotMessageSender = (m: MentionnedUser | DBUser) => !isSender(m);
      const [otherIntruders, senderIntruders] = unmerge(
        intruders,
        isNotMessageSender
      );

      if (senderIntruders.length > 0) {
        ctx.telegram.sendMessage(ctx.chat.id,
          `${userToName(ctx.message.from)} you are an intruder. Ask someone in the group to vouch for you.`,
          {}
        );
        return;
      }

      ctx.telegram.sendMessage(ctx.chat.id,
        otherIntruders.length <= 0
          ? 'No intruders that I know of. Make sure to greet everyone already in the group with /greet @user1 ... Once I\'ve greeted a member (or when they enter the group, or they say something), I become aware of their existence.'
          : `${userToName(ctx.message.from)} here's the list of intruders:\n${commaSepExceptForLastOne(otherIntruders.filter(isNotMessageSender).map(userToName))}.\nNote that, if you added me to an existing group, this is probably not a complete list.\nMake sure you make me greet every member of the group. I will aknowledge them when they write, or join the group.`,
        {}
      );
    });

    this.bot.command('greet', async ctx => {
      const { update } = ctx;
      const { byContactName, byUsername } = getMentionnedUsers(update);
      const usersToSave = [...byContactName, ctx.message.from, ...byUsername];
      const savedMembers = await watchMembersBis(this.models, usersToSave, ctx.chat.id);
      const isSender = isSameUser(ctx.message.from);
      const isNotMessageSender = (m: MentionnedUser | DBUser) => !isSender(m);

      ctx.telegram.sendMessage(ctx.chat.id,
        `Thank you ${userToName(ctx.message.from)}! Greetings to ${commaSepExceptForLastOne(savedMembers.filter(isNotMessageSender).map(userToName))}. Ask someone in the group to vouch for you (in case you have not already).`,
        {}
      );
    });

    this.bot.command('greeted', async ctx => {
      const { UserModel } = this.models;
      const members = await UserModel.getUsers();
      ctx.telegram.sendMessage(ctx.chat.id, members.length <= 0
        ? `I haven't greeted any members yet. I will, when they join the group. Existing members can be greeted by using /greet @user1 @user2 ...`
        : `The following members have already been greeted:\n${members.map(userToName).join('\n')}`,
        {}
      );
    });

    this.bot.on('text', async (ctx) => {
      await watchMembersBis(this.models, [ctx.message.from], ctx.chat.id);
    });

    // TODO create an interval function that will run every 24 hours to remind people to vouch for new member
    this.bot.on('new_chat_members', async (ctx) => {
      const members = await watchMembersBis(this.models, ctx.message.new_chat_members, ctx.chat.id);
      ctx.telegram.sendMessage(ctx.chat.id,
        `Welcome ${commaSepExceptForLastOne(members.map(userToName))}, do you know someone who can vouch for you.`,
        {}
      );
    });

  }

  public run() {
    this.bot.launch();
  }

}

export default BotService;