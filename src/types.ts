import { Context, Telegraf, Telegram } from 'telegraf';
import { ChatMember, ChatMemberAdministrator, ChatMemberOwner, Message, Update, User } from "telegraf/typings/core/types/typegram";

export type TelegramBot = Telegraf<Context<Update>>;

export type BotServiceInterface = {
  run: () => void;
}

export interface BotServiceConstructor {
    new(bot: TelegramBot): BotServiceInterface;
}

export type UUID = string;
export type UUIDProp = { UUID: UUID; };

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export type UsernameMention = Partial<TelegramUser> & {
  username: string;
}

export function isUsernameMention(u: UserCreateProps): u is UsernameMention {
  return typeof u.username === 'string';
}

export type UserCreateProps = TelegramUser | UsernameMention;

export type ChatMemberStatus = ChatMember["status"];

export type DBTelegramUser = UUIDProp & {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name: string|null;
  username: string|null;
}

export type DBUsernameMentionUser = UUIDProp & {
  id: number|null;
  is_bot: boolean|null;
  first_name: string|null;
  last_name: string|null;
  username: string;
}

export type StatusProp = { status: ChatMember["status"] };
export type DBUser = DBTelegramUser | DBUsernameMentionUser;
export type DBUserWithStatus = DBUser & StatusProp;
export type UsernameProp = { username: string; }
export type IdProp = { id: number; }
export type UsernameMentionnedUser = UsernameProp & Partial<IdProp>;
export type ContactNameMentionnedUser = User;

export type MentionnedUser = ContactNameMentionnedUser | UsernameMentionnedUser;

export type SavedMentionnedUser = MentionnedUser & UUIDProp;

export type SavedAllTelegramDataUser = UUIDProp & {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export type ByContactName = { byContactName: User, byUsername?: UsernameMentionnedUser; }
export type ByUsername = { byContactName?: User, byUsername: UsernameMentionnedUser; }
export type ByContactNameOrUsername = ByContactName | ByUsername;
export function isByContactName(b: ByContactNameOrUsername): b is ByContactName {
  return typeof b.byContactName !== 'undefined';
}

export type BotServiceUserModel = {
  getUsers: (usersByName?: User[], usersByUsername?: UsernameMentionnedUser[]) => Promise<DBUser[]>;
  getUsersByUUID: (UUIDs: UUID[]) => Promise<DBUser[]>;
  getChatAdministrators(chatId: number, ownerOnly?: boolean): Promise<DBUser[]>;
  saveGetDBUser(props: ByContactNameOrUsername): Promise<DBUser>;
  getChatOwner(chatId: number): Promise<DBUser>;
  saveChatAdministrators(props: (ChatMemberOwner|ChatMemberAdministrator)[], chatId: number, botId: number): Promise<DBUserWithStatus[]>;
  getChatOwner(chatId: number): Promise<DBUser>;
}

export type GraphUserModel = {
  saveUser({ UUID }: { UUID: UUID; }, chatId: number): Promise<boolean>;
  saveUsers(users: { UUID: string; }[], chatId: number): Promise<boolean[]>;
  saveChatVouch(voucher: { UUID: UUID }, vouchee: { UUID: UUID }, chatId: number): Promise<void>;
  getChatShortestPath(start: { UUID: UUID; }, end: { UUID: UUID; }, chatId: number): Promise<UUID[]>;
  getChatIntruders({ UUIDs }: { UUIDs: UUID[]; }, chatId: number): Promise<UUID[]>
  getChatImmediateVouchersUUIDs({ UUID }: { UUID: UUID; }, chatId: number): Promise<UUID[]>;
  saveChatUnvouch(voucher: { UUID: string }, vouchee: { UUID: string }, chatId: number): Promise<void>;
}

export type HandlerUpdateParam = {
  message: Update.New & Update.NonChannel & Message.TextMessage;
  update_id: number;
}
export type CommandHandlerProps = { update: HandlerUpdateParam; telegram: Telegram; }

export type BotServiceModels = {
  UserModel: BotServiceUserModel;
  graphUserModel: GraphUserModel;
}

export type Vouch = {
  user: Voucher;
  idVouches: ContactNameMentionnedUser[];
  noIdVouches: UsernameMentionnedUser[];
}

export type VouchDict = {
  [k: string]: Vouch;
}

export type FirstNameProp = {
  first_name: string;
}

export type UsernameUser = UsernameProp & IdProp;
export type ContactNameUser = FirstNameProp & IdProp;
export type Voucher = UsernameUser | ContactNameUser;

export type GetChatMemberProp = { getChatMember: (cid: number, uid: number) => Promise<ChatMember>; }