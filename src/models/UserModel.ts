import { randomUUID } from 'crypto';
import { RequestorModel } from 'mysql-oh-wait';
import { isActionResultError } from 'mysql-oh-wait/build/src/ActionResult';
import { unmerge } from 'swiss-army-knifey';
import { ChatMemberAdministrator, ChatMemberOwner, User } from 'telegraf/typings/core/types/typegram';
import { ByContactNameOrUsername, DBUser, isByContactName, UsernameMentionnedUser, UUID, ChatMemberStatus, DBUserWithStatus } from '../types';

export enum CreateOutcomeCode {
  userExists='USER_EXISTS',
  emailExists='EMAIL_EXISTS',
  usernameNotAvailable='USERNAME_NOT_AVAILABLE',
  userCreated='USER_CREATED',
  forbidden='FORBIDDEN',
}

function ifNullUndefinedOrValue<T>(a: T) {
  return a === null
    ? undefined
    : a;
}

export default class UserModel extends RequestorModel {

  static async getUsers(usersByContact?: User[], usersByUsername?: UsernameMentionnedUser[]) {
    return (await (usersByContact || usersByUsername ? UserModel.getDBUsers(usersByContact || [], usersByUsername || []) : UserModel.getDBUsers()));
  }

  static async getChatAdministrators(chatId: number, ownerOnly: boolean = false): Promise<DBUser[]> {
    const result = await UserModel.query<DBUser[]>({
      sql: `
        SELECT
          u.\`UUID\`,
          u.\`id\`,
          u.\`username\`,
          u.\`first_name\`,
          u.\`last_name\`,
          u.\`is_bot\`
        FROM
          User AS u
          INNER JOIN \`Users_to_Chats\` AS uc
            ON u.UUID = uc.userUUID AND uc.status ${ownerOnly
              ? "= 'creator'"
              : "IN ('creator','administrator')"}
        WHERE
          uc.chatId = :chatId
        ;
      `,
      values: { chatId, },
    });

    if (isActionResultError(result)) {
      throw result.error;
    }

    return result.value;
  }

  static async saveChatAdministrators(props: (ChatMemberOwner|ChatMemberAdministrator)[], chatId: number, botId: number): Promise<DBUserWithStatus[]> {
    type InserValues = [UUID, number, ChatMemberStatus];
    type Reduc = { insertValues: InserValues[], selectValues: UUID[], }
    const values = (await Promise.all(
      props
        .filter(({ user }) => user.id !== botId)
        .map(async ({ user, status }) => ({
          dbUser: await UserModel.saveGetDBUser({ byContactName: user }),
          status
        }))))
        .reduce((p: Reduc, { dbUser: { UUID }, status }) => ({
            insertValues: [
              ...p.insertValues,
              [UUID, chatId, status] as InserValues,
            ],
            selectValues: [...p.selectValues, UUID],
          }),
          {
            insertValues: [],
            selectValues: [],
          }
        );

    const insertSelectActionResult = await UserModel.query<[{}[], DBUserWithStatus[]]>({
      sql: `
        INSERT INTO \`Users_to_Chats\` (
          \`userUUID\`,
          \`chatId\`,
          \`status\`
        ) VALUES :insertValues
         ON DUPLICATE KEY UPDATE
          status = VALUES(status)
        ;
        SELECT
          u.\`UUID\`,
          u.\`id\`,
          u.\`username\`,
          u.\`first_name\`,
          u.\`last_name\`,
          u.\`is_bot\`,
          uc.\`status\`
        FROM
          User AS u
          INNER JOIN \`Users_to_Chats\` AS uc
            ON u.UUID = uc.userUUID
              AND uc.chatId = :chatId
              AND uc.status IN ('creator', 'administrator')
        WHERE
          UUID IN :selectValues
        ;
      `,
      values: {
        ...values,
        chatId,
      },
    });

    if (isActionResultError(insertSelectActionResult)) {
      throw insertSelectActionResult.error;
    }

    const dbAdmins = insertSelectActionResult.value[1];
    if (dbAdmins.length === 0) {
      return [];
    }
    const isCurrentListInGroup = (u: { UUID: UUID; }) => -1 !== values.selectValues.findIndex(UUID => UUID === u.UUID)
    const [currentAdmins, demotedAdmins] = unmerge(dbAdmins, isCurrentListInGroup);
    if (demotedAdmins.length > 0) {
      const demoteActionResult = await UserModel.query<[{}[], DBUser[]]>({
        sql: `
          UPDATE \`Users_to_Chats\`
          SET
            \`status\` = 'member'
          WHERE
            \`chatId\` = :chatId
            AND \`userUUID\` IN :UUIDs
          ;
        `,
        values: {
          chatId,
          UUIDs: demotedAdmins.map(da => da.UUID),
        }
      });
      if (isActionResultError(demoteActionResult)) {
        throw demoteActionResult.error;
      }
    }

    return currentAdmins;
  }

  static async getUsersByUUID(UUIDs: UUID[]) {
    if (UUIDs.length <= 0) {
      return [];
    }
    const selectActionResult3 = await UserModel.query<DBUser[]>({
      sql: `SELECT
          UUID,
          id,
          username,
          first_name,
          last_name,
          is_bot
        FROM User AS u
          WHERE UUID IN :UUIDs
        `,
        values: { UUIDs }
    });
    if (isActionResultError(selectActionResult3)) {
      throw selectActionResult3.error;
    }
    return selectActionResult3.value;
  }

  static async getDBUsers(usersByContact?: User[], usersByUsername?: UsernameMentionnedUser[]): Promise<DBUser[]> {
    if (typeof usersByContact === 'undefined') {
      const selectActionResult3 = await UserModel.query<DBUser[]>({
        sql: `SELECT
            UUID,
            id,
            username,
            first_name,
            last_name,
            is_bot
          FROM User AS u
          `,
      });

      if (isActionResultError(selectActionResult3)) {
        throw selectActionResult3.error;
      }

      return selectActionResult3.value;
    }

    const hasByUsername = typeof usersByUsername !== 'undefined' && usersByUsername.length > 0;
    const byUsernameSql = `SELECT
        UUID,
        id,
        username,
        first_name,
        last_name,
        is_bot
      FROM User AS u
        WHERE u.username IN :usernames
    `;

    const hasByContactName = typeof usersByContact !== 'undefined' && usersByContact.length > 0;
    const byContactNameSql = `SELECT
        UUID,
        id,
        username,
        first_name,
        last_name,
        is_bot
      FROM User AS u
        WHERE u.id IN :ids
    `;

    const selectActionResult1 = await UserModel.query<DBUser[]>({
      sql: `
        ${hasByUsername ? byUsernameSql : ''}
        ${hasByUsername && hasByContactName ? 'UNION' : ''}
        ${hasByContactName ? byContactNameSql : ''}
        ;`,
      values: {
        ...(hasByUsername ? { usernames: usersByUsername.map(u => u.username), } : {}),
        ...(hasByContactName ? { ids: usersByContact.map(u => u.id), } : {}),
      },
    });

    if (isActionResultError(selectActionResult1)) {
      throw selectActionResult1.error;
    }

    return selectActionResult1.value;
  }

  static async formatToUndefinedOnNull(u: DBUser) {
    return {
      ...u,
      id: ifNullUndefinedOrValue(u.id),
      username: ifNullUndefinedOrValue(u.username),
      first_name: ifNullUndefinedOrValue(u.first_name),
      last_name: ifNullUndefinedOrValue(u.last_name),
      is_bot: ifNullUndefinedOrValue(u.is_bot),
    };
  }

  static async saveGetDBUser(props: ByContactNameOrUsername): Promise<DBUser> {
    const isContactName = isByContactName(props);
    const user = isContactName ? props.byContactName : props.byUsername;
    const baseDbProps = {
      id: null,
      username: null,
      first_name: null,
      last_name: null,
      is_bot: false,
    }
    const propsNoUUID = {
      ...baseDbProps,
      ...user,
    }
    const allProps = {
      UUID: randomUUID(),
      ...propsNoUUID,
    }

    const dbFields = Object.keys(baseDbProps);
    const nonNullEntries = Object.entries(propsNoUUID).filter(([k, v]) => dbFields.indexOf(k) !== -1 && v !== null);
    const updateWithValues = nonNullEntries.map(([k, v]) => `\`${k}\` = VALUES(\`${k}\`)`);

    const whereCriteria = nonNullEntries.filter(([k,]) => ['id', 'username'].indexOf(k) !== -1).map(([k, v]) => `${k} = :${k}`);
    if (whereCriteria.length <= 0) {
      throw new Error('There should at least be and id or username, weird' + String(propsNoUUID));
    }

    const insertActionResult = await UserModel.query<[{}[], DBUser[]]>({
      sql: `
        INSERT INTO \`User\` (
          \`UUID\`,
          \`id\`,
          \`username\`,
          \`first_name\`,
          \`last_name\`,
          \`is_bot\`
        ) VALUES (
          :UUID,
          :id,
          :username,
          :first_name,
          :last_name,
          :is_bot
        ) ON DUPLICATE KEY UPDATE
          ${updateWithValues.join(`,\n`)}
        ;
        SELECT
          \`UUID\`,
          \`id\`,
          \`username\`,
          \`first_name\`,
          \`last_name\`,
          \`is_bot\`
        FROM
          User
        WHERE
          ${whereCriteria.join(`\nAND `)}
        ;
      `,
      values: allProps,
    });

    if (isActionResultError(insertActionResult)) {
      throw insertActionResult.error;
    }
    return insertActionResult.value[1][0];
  }

}