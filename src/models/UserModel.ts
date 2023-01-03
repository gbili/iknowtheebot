import { randomUUID } from 'crypto';
import { RequestorModel } from 'mysql-oh-wait';
import { isActionResultError } from 'mysql-oh-wait/build/src/ActionResult';
import { User } from 'telegraf/typings/core/types/typegram';
import { ByContactNameOrUsername, DBUser, isByContactName, UsernameMentionnedUser, UUID } from '../types';
import { keepMostInfo } from '../utils/mentionnedUsers';

export enum CreateOutcomeCode {
  userExists='USER_EXISTS',
  emailExists='EMAIL_EXISTS',
  usernameNotAvailable='USERNAME_NOT_AVAILABLE',
  userCreated='USER_CREATED',
  forbidden='FORBIDDEN',
}

function makeUndefinedToNull<T extends { [k: number|string]: number|string|boolean|undefined|null; }>(props: T) {
  return Object.entries(props).map(([k, v]): [number|string, number|string|boolean|null] => [k, v === undefined ? null : v]).reduce((p, [k, v]) => ({...p, [k]: v, }), {})
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

    // const selectActionResult2 = await UserModel.query<DBUser[]>({
    //   sql: `
    //     `,
    //   values: { id: props.id },
    // });
    // if (isActionResultError(selectActionResult2)) {
    //   throw selectActionResult2.error;
    // }
    // return selectActionResult2.value;
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

  static async saveUserGetUUID(props: ByContactNameOrUsername): Promise<DBUser> {
    try {
      const isContactName = isByContactName(props);
      const user = isContactName ? props.byContactName : props.byUsername;
      const params: [User[], UsernameMentionnedUser[]] = isContactName ? [[props.byContactName] , []] : [[], [props.byUsername]];
      const matchingUsers = await this.getUsers(...params);
      if (matchingUsers.length > 0) {
        const dbUser = matchingUsers[0];
        const update = keepMostInfo(dbUser, user);
        const userWithAllAvailableData = update.result;
        if (update.unaltered === false) {
          const selectActionResult = await UserModel.query<{}[]>({
            sql: `UPDATE User
              SET
                username=:username,
                first_name=:first_name,
                last_name=:last_name,
                is_bot=:is_bot
              WHERE
                UUID=:UUID
              ;
              `,
            values: {
              ...userWithAllAvailableData,
            },
          });
          if (selectActionResult.error) {
            throw selectActionResult.error
          }
          return { ...userWithAllAvailableData }; // updated username and other props (only when username was not priorly set)
        }
        return dbUser; // added nothing
      }

      const baseDbProps = {
        id: null,
        username: null,
        first_name: null,
        last_name: null,
        is_bot: false,
      }
      const propsAddInexistentAsNullPlusUUID = {
        UUID: randomUUID(),
        ...baseDbProps,
        ...user,
      }
      const allPropsSet = makeUndefinedToNull(propsAddInexistentAsNullPlusUUID) as DBUser;
      const inserActionResult = await UserModel.query<{}[]>({
        sql: `INSERT INTO User (
            UUID,
            id,
            username,
            first_name,
            last_name,
            is_bot
          )
          VALUES (
            :UUID,
            :id,
            :username,
            :first_name,
            :last_name,
            :is_bot
          );
          `,
        values: allPropsSet,
      });

      if (isActionResultError(inserActionResult)) {
        throw inserActionResult.error;
      }

      return allPropsSet;
    } catch (err) {
      throw err;
    }
  }

}