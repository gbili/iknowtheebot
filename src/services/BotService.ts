import { Telegraf } from 'telegraf/typings/telegraf';
import { BotServiceInterface, BotServiceModels, BotServiceUserModel, DBUser, GraphUserModel, MentionnedUser } from '../types';
import getMentionnedUsers, { handleVouchUnvouch, watchMembers, isSameUser, userToName, handleVouchPathAndVouchersOf, outcomeMessageGen } from '../utils/mentionnedUsers';

class BotService implements BotServiceInterface {

  private bot: Telegraf;
  private models: BotServiceModels;

  public constructor(props: { bot: Telegraf; models: { UserModel: BotServiceUserModel; graphUserModel: GraphUserModel; }}) {
    this.bot = props.bot;
    this.models = props.models;

    // TODO 
    // 5. Let people know that :
    // This bot tries to keep a vibrant community of people who know each other
    // When a user is not vouched for, he/she will be automatically banned after 3 days
    // - You can reply to the I Know Thee bot's welcome message to vouch for the new member
    // - "/vouch @username" lets you vouch for that specific user
    // - Installation: add me to a group
    this.bot.command('help', ctx => {
      console.log(`------------ help:ctx`);
      console.log(ctx)
      this.bot.telegram.sendMessage(ctx.chat.id, `Use any of the following:
        - Vouch for a user
        /vouch @user
        - Check who vouched for user
        /vouchersOf @user
        - Remove your vouch for user
        /unvouch @user
        - Add a user to the watchlist (bot api cannot access a group's members list, so you can manually add existing users to be watched)
        /greet @user
        - Check who's being watched
        /greeted`, {}
      );
    });

    // TODO on add new members make sure to add them to the list of group members. We need to have one separate from that of the group.
    // TODO on delete members, make sure to remove from the list as well.
    // TODO vouchersOf, make sure to add a @ in front of usableName

    // bot.on('message', async (ctx) => {
    //   console.log(`------------ messages:ctx`);
    //   console.log(ctx)
    //   const mess = await bot.telegram.sendMessage(ctx.chat.id, `A 'message' was sent at ${new Date()}`, {})
    //   console.log('bot mess', mess);
    //   bot.telegram.editMessageText(ctx.chat.id, mess.message_id, undefined, `Here is new text for ${mess.message_id} : ${mess.text}`);
    //   const updates = await bot.telegram.getUpdates(1000, 10, 0, undefined);
    //   console.log('updates: ', updates);
    // });

    // TODO
    // 4. Listen to /vouch @username command
    // make sure from_id and @username exist in member database and call iVouchForThee(member_id, member_id)
    // {
    //   message_id: 21,
    //   from: {
    //     id: 791636381,
    //     is_bot: false,
    //     first_name: 'Bill',
    //     username: 'gbili',
    //     language_code: 'en'
    //   },
    //   chat: {
    //     id: -1001752341329,
    //     title: 'Hello',
    //     username: 'thisisapublicgroupplease',
    //     type: 'supergroup'
    //   },
    //   date: 1654543119,
    //   text: '/vouch @dunbo51 comment?',
    //   entities: [ { offset: 7, length: 8, type: 'mention' } ]
    // }
    this.bot.command('vouch', async ({ update }) => {
      console.log(`------------ vouch:ctx`);
      await handleVouchUnvouch(this.bot, this.models, update, 'vouch');
    });

    this.bot.command('unvouch', async ({ update }) => {
      console.log(`------------ vouch:ctx`);
      await handleVouchUnvouch(this.bot, this.models, update, 'unvouch');
    });


    this.bot.command('vouchPath', handleVouchPathAndVouchersOf(
      this.models,
      async (watchedMentionnedUser: DBUser) => this.models.graphUserModel.getShortestPath((await this.models.UserModel.getUsers(undefined, [{ username: 'gbili' }]))[0], watchedMentionnedUser),
      outcomeMessageGen(
        'vouchPath',
        "Here's the link between",
        ' and the group owner',
        ' -> '
      )
    ));
    // async ctx => {
      // console.log(`------------ vouchPath:ctx`);
      // console.log(ctx)
      // const { update } = ctx;
      // const { byContactName, byUsername } = getMentionnedUsers(update);
      // const mentionnedUsers = [...byContactName, ...byUsername];

      // if (mentionnedUsers.length <= 0) {
      //   this.bot.telegram.sendMessage(ctx.chat.id, `Have you mentionned any user? Make sure to add an @ even before a non username mention.`, {});
      //   return;
      // }

      // const watchedMentionnedUsers = await this.models.UserModel.getUsers(byContactName, byUsername);

      // if ((mentionnedUsers.length > 0 || mentionnedUsers.length <= 1) && watchedMentionnedUsers.length <= 0) {
      //   this.bot.telegram.sendMessage(ctx.chat.id, `${userToName(mentionnedUsers[0])} has no vouchers, and has not been /greeted so far. I'll do it now.`, {});
      //   this.bot.telegram.sendMessage(ctx.chat.id, `/greet ${userToName(mentionnedUsers[0])}`, {});
      //   return;
      // }

      // const owners = await this.models.UserModel.getUsers(undefined, [{ username: 'gbili' }]);
      // const pathUUIDs = mentionnedUsers.length <= 0 || mentionnedUsers.length > 1
      //   ? []
      //   : await this.models.graphUserModel.getShortestPath(owners[0], watchedMentionnedUsers[0]);

      // const byBreadcumbPosition = (a: DBUser, b: DBUser) => pathUUIDs.indexOf(a.UUID) - pathUUIDs.indexOf(b.UUID);
      // const pathUsers = (await this.models.UserModel.getUsersByUUID(pathUUIDs)).sort(byBreadcumbPosition);

      // this.bot.telegram.sendMessage(ctx.chat.id, mentionnedUsers.length <= 0 || mentionnedUsers.length > 1
      //   ? `Please specify one user as in /vouchPath \\@user`
      //   : `Here's the link between ${userToName(mentionnedUsers[0])} and the group owner: \n ${pathUsers.length > 0 ? pathUsers.map(userToName).join(' -> ') : `As far as I can tell it's an intruder`}`,
      //   {}
      // );
    // });

    this.bot.command('vouchersOf', handleVouchPathAndVouchersOf(
      this.models,
      async (watchedMentionnedUser: DBUser) => await this.models.graphUserModel.getImmediateVouchersUUIDs(watchedMentionnedUser),
      outcomeMessageGen(
        'vouchersOf',
        "Here's who vouched for",
        '',
        ', '
      )
    ));
    // async ctx => {
    //   console.log(`------------ vouchersOf:ctx`);
    //   console.log(ctx)
    //   const { update } = ctx;
    //   const { byContactName, byUsername } = getMentionnedUsers(update);
    //   const mentionnedUsers = [...byContactName, ...byUsername];

    //   console.log('mentionnedUsers', mentionnedUsers);

    //   const watchedMentionnedUsers = await this.models.UserModel.getUsers(byContactName, byUsername);

    //   if ((mentionnedUsers.length > 0 || mentionnedUsers.length <= 1) && watchedMentionnedUsers.length <= 0) {
    //     this.bot.telegram.sendMessage(ctx.chat.id, `${userToName(mentionnedUsers[0])} has no vouchers, and has not been /greeted so far. I'll do it now.`, {});
    //     this.bot.telegram.sendMessage(ctx.chat.id, `/greet ${userToName(mentionnedUsers[0])}`, {});
    //     return;
    //   }

    //   const vouchersUUIDs = mentionnedUsers.length <= 0 || mentionnedUsers.length > 1
    //     ? []
    //     : await this.models.graphUserModel.getImmediateVouchersUUIDs(watchedMentionnedUsers[0]);
    //   const byBreadcumbPosition = (a: DBUser, b: DBUser) => vouchersUUIDs.indexOf(a.UUID) - vouchersUUIDs.indexOf(b.UUID);
    //   const vouchers = (await this.models.UserModel.getUsersByUUID(vouchersUUIDs)).sort(byBreadcumbPosition);

    //   this.bot.telegram.sendMessage(ctx.chat.id, mentionnedUsers.length <= 0 || mentionnedUsers.length > 1
    //     ? `Please specify one user as in /vouchersOf \\@user`
    //     : `Here's who vouched for ${userToName(mentionnedUsers[0])}: \n ${vouchers.length > 0 ? vouchers.map(userToName).join(', ') : `As far as I can tell it's an intruder`}`,
    //     {}
    //   );
    // });

    this.bot.command('watch', async ctx => {
      console.log(`------------ inspect:ctx`);
      console.log(ctx)
      const { update } = ctx;
      const { byContactName, byUsername } = getMentionnedUsers(update);
      const mentionnedUsers = [...byContactName, ctx.message.from, ...byUsername];

      console.log('mentionnedUsers', mentionnedUsers);

      const { UserModel } = this.models;

      const [alreadyWatchedMentions, nonWatchedMentions] = await watchMembers(UserModel, await UserModel.getUsers(), mentionnedUsers, false);
      console.log('alreadyWatchedMentions', alreadyWatchedMentions);
      console.log('nonWatchedMentions', nonWatchedMentions);
      const isSender = isSameUser(ctx.message.from);
      const isNotMessageSender = (m: MentionnedUser | DBUser) => !isSender(m);
      const existingMembersMessage = alreadyWatchedMentions.length > 0
        ? `These were already watched: ${alreadyWatchedMentions.filter(isNotMessageSender).map(userToName).join(', ')}.`
        : ``
      const newMembersMessage = nonWatchedMentions.length > 0
        ? `New members watched: ${nonWatchedMentions.map(userToName).join(', ')}.`
        : ``
      this.bot.telegram.sendMessage(ctx.chat.id,
        `${newMembersMessage}\n${existingMembersMessage}`,
        {}
      );
    });

    this.bot.command('greeted', async ctx => {
      console.log(`------------ greeted:ctx`);
      console.log(ctx)
      const { UserModel } = this.models;
      const members = await UserModel.getUsers();
      ctx.telegram.sendMessage(ctx.chat.id, members.length <= 0
        ? `I haven't greeted any members yet. I will when they join the group. Existing members can be greeted by using /greet @user1 @user2 ...`
        : `I have greeted the following members already :\n${members.map(userToName).join('\n')}`,
        {}
      );
    });

    // TODO
    // ----------- [orphan/adopted]:
    // has not been added attached to the main graph of adam and eve
    // Any user is
      // adopted when in GMvalidated
      // orphan otherwise
    // ----------- [knownId/unknownId]:
    // whether we have had a chance to get the id
    // vouchers are always knownId and orphan/adopted
    // vouchees can be knownId/unknwon and can be orphan/adopted
      // knownId when their mention is a 'text_mention'
      // unknownId when their mention is @someone, only until they write a message

    // global messages whose id we need, and that we need to track
    // pendingVUnr: "validated voucher:unrecognied vouchee": 12312312:@vouchee. Someone vouched for them
    // pendingVUnr: "pending voucher:unrecognies vouched": <@voucher|12312312>:@vouchee. Someone vouched for them

    // whenever the user is mentionned it is added to the known users
    // if a user posts again, his id and username will appear

    // in message: fetch bot message where pending users to be validated are listed. If the username matches, then we remove his username from "pending" and add it to validated

    // TODO 
    // 3. allow people to vouch for members by replying to welcome_message_id
    // - check whether ctx has a 'reply_to_message' property
      // => if it does, look members table in db to check if there is a row with that welcome_message_id (and extract the user_id)
      // .  also check if 'from:id' is a member of the group (is in table members)
      //     => if voucher is a member call iVouchForThee(member_id, member_id) to save the vouching in vouches table
      // send a message to bill for abuse and do nothing
    this.bot.on('text', async (ctx) => {
      // {
      //   message_id: 17,
      //   from: {
      //     id: 791636381,
      //     is_bot: false,
      //     first_name: 'Bill',
      //     username: 'gbili',
      //     language_code: 'en'
      //   },
      //   chat: {
      //     id: -1001752341329,
      //     title: 'Hello',
      //     username: 'thisisapublicgroupplease',
      //     type: 'supergroup'
      //   },
      //   date: 1654541801,
      //   reply_to_message: {
      //     message_id: 16,
      //     from: {
      //       id: 5374530320,
      //       is_bot: true,
      //       first_name: 'I Know Thee',
      //       username: 'IKnowTheeBot'
      //     },
      //     chat: {
      //       id: -1001752341329,
      //       title: 'Hello',
      //       username: 'thisisapublicgroupplease',
      //       type: 'supergroup'
      //     },
      //     date: 1654541430,
      //     text: 'Hello -1001752341329!'
      //   },
      //   text: 'Booo'
      // }
      console.log(`------------ bot.on('text', ctx).message`);
      console.log(ctx.message);
      const { UserModel } = this.models;
      console.log('models', this.models);
      console.log('UserModels', this.models.UserModel);
      const [alreadyWatchedMentions, nonWatchedMentions] = await watchMembers(UserModel, await UserModel.getUsers(), [ctx.message.from], true);
      console.log('alreadyWatchedMentions', alreadyWatchedMentions);
      console.log('nonWatchedMentions', nonWatchedMentions);

      // const existingMembersMessage = alreadyWatchedMentions.length > 0
      //   ? `Welcome back ${alreadyWatchedMentions.map(userToName).join(', ')}`
      //   : ''
      // const newMembersMessage = nonWatchedMentions.length > 0
      //   ? `Welcome ${nonWatchedMentions.map(userToName).join(', ')}, do you know someone who can vouch for you.`
      //   : ''
      // this.bot.telegram.sendMessage(ctx.chat.id,
      //   `${newMembersMessage}\n${existingMembersMessage}`,
      //   {}
      // );
      // ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${userToName(ctx.message.from)}:${ctx.message.from.id}! Your message has id: ${ctx.message.message_id}`);
    });



    // TODO
    // 1. on bot being added to group
    // store the group id in the database

    // 2. on new member being added
    // - sendMessage(ctx.message.chat.id, "Welcome dear user (username and first last name)").then((message) => {
          // store this id in database (as it will be used to listen to vouching replies)
    //    console.log(message.message_di);
    // })
    // - store user_id, username, group_id and welcome_message_id (se bullet above)
    // - create an interval function that will run every 24 hours to remind people to vouch for new member

    this.bot.on('new_chat_members', async (ctx) => {
      // adding bot to group

      // {
      //   message_id: 6,
      //   from: {
      //     id: 791636381,
      //     is_bot: false,
      //     first_name: 'Bill',
      //     username: 'gbili',
      //     language_code: 'en'
      //   },
      //   chat: {
      //     id: -1001752341329,
      //     title: 'Hello',
      //     username: 'thisisapublicgroupplease',
      //     type: 'supergroup'
      //   },
      //   date: 1654539426,
      //   new_chat_participant: {
      //     id: 5374530320,
      //     is_bot: true,
      //     first_name: 'I Know Thee',
      //     username: 'IKnowTheeBot'
      //   },
      //   new_chat_member: {
      //     id: 5374530320,
      //     is_bot: true,
      //     first_name: 'I Know Thee',
      //     username: 'IKnowTheeBot'
      //   },
      //   new_chat_members: [
      //     {
      //       id: 5374530320,
      //       is_bot: true,
      //       first_name: 'I Know Thee',
      //       username: 'IKnowTheeBot'
      //     }
      //   ]
      // }

      // adding regular user

      // {
      //   message_id: 8,
      //   from: {
      //     id: 791636381,
      //     is_bot: false,
      //     first_name: 'Bill',
      //     username: 'gbili',
      //     language_code: 'en'
      //   },
      //   chat: {
      //     id: -1001752341329,
      //     title: 'Hello',
      //     username: 'thisisapublicgroupplease',
      //     type: 'supergroup'
      //   },
      //   date: 1654539514,
      //   new_chat_participant: {
      //     id: 705370572,
      //     is_bot: false,
      //     first_name: 'Alexandre',
      //     last_name: 'de Lisle',
      //     username: 'dunbo51'
      //   },
      //   new_chat_member: {
      //     id: 705370572,
      //     is_bot: false,
      //     first_name: 'Alexandre',
      //     last_name: 'de Lisle',
      //     username: 'dunbo51'
      //   },
      //   new_chat_members: [
      //     {
      //       id: 705370572,
      //       is_bot: false,
      //       first_name: 'Alexandre',
      //       last_name: 'de Lisle',
      //       username: 'dunbo51'
      //     }
      //   ]
      // }
      console.log(`------------ pbot.on('new_chat_members', ctx).message`);
      console.log(ctx.message);
      const { UserModel } = this.models;
      const [alreadyWatchedMentions, nonWatchedMentions] = await watchMembers(UserModel, await UserModel.getUsers(), ctx.message.new_chat_members, true);
      const existingMembersMessage = alreadyWatchedMentions.length > 0
        ? `Welcome back ${alreadyWatchedMentions.map(userToName).join(', ')}`
        : ''
      const newMembersMessage = nonWatchedMentions.length > 0
        ? `Welcome ${nonWatchedMentions.map(userToName).join(', ')}, do you know someone who can vouch for you.`
        : ''
      ctx.telegram.sendMessage(ctx.chat.id,
        `${newMembersMessage}\n${existingMembersMessage}`,
        {}
      );
    });

    this.bot.on('pinned_message', (ctx) => {
      console.log(`------------ pbot.on('inned_message', ctx)`);
      console.log(ctx);
    });

  }

  public run() {
    this.bot.launch();
  }

}

export default BotService;