import { Driver } from "neo4j-driver-core";
import { UUID } from "../types";

export default class GraphUserModel {

  public constructor(private props: { driver: Driver }) {}

  async saveUser({ UUID }: { UUID: string; }, chatId: number): Promise<boolean> {
    const session = this.props.driver.session();
    try {
      const result = await session.run(
        `MERGE (user:User {UUID: $UUID})
        MERGE (chat:Chat {chatId: $chatId})
        MERGE (user)-[:IS_IN]-(chat)
        RETURN user, chat
        `,
        {
          UUID,
          chatId,
        }
      );
      return result.records[0].get('user');
    } finally {
      session.close();
    }
  }

  async saveUsers(users: { UUID: string; }[], chatId: number) {
    return await Promise.all(users.map(u => this.saveUser(u, chatId)));
  }

  async getChatIntruders({ UUIDs }: { UUIDs: UUID[]; }, chatId: number) {
    const session = this.props.driver.session();

    try {
      const result = await session.run(
        `
        MATCH
          (user:User)-[:IS_IN]->(chat:Chat {chatId: $chatId}),
          (vouchingUser:User)-[:IS_IN]->(chat:Chat {chatId: $chatId})
        WHERE
          vouchingUser.UUID IN $UUIDs
          AND NOT user.UUID IN $UUIDs
          AND NOT (user)<-[:VOUCHED_FOR* {chatId: $chatId}]-(vouchingUser)
        WITH user.UUID AS UUID, count(user.UUID) AS UUIDCount
        WHERE UUIDCount >= $totalDisconnectionThreshold
        RETURN collect(UUID) AS UUIDs
        `,
        {
          UUIDs,
          chatId,
          totalDisconnectionThreshold: UUIDs.length
        }
      );
      if (result.records.length <= 0) {
        return [];
      }
      return result.records[0].get('UUIDs') as UUID[];
    } finally {
      session.close();
    }
  }

  async saveChatVouch(voucher: { UUID: string }, vouchee: { UUID: string }, chatId: number) {
    if (voucher.UUID === vouchee.UUID) {
      return;
    }

    const session = this.props.driver.session();
    try {
      await this.saveUsers([voucher, vouchee], chatId);
      await session.run(
        `MATCH (voucher:User {UUID: $voucherUUID}), (vouchee:User {UUID: $voucheeUUID})
        CREATE (voucher)-[:VOUCHED_FOR {chatId: $chatId}]->(vouchee)`,
        {
          voucherUUID: voucher.UUID,
          voucheeUUID: vouchee.UUID,
          chatId,
        }
      );
    } finally {
      session.close();
    }
  }

  async saveChatUnvouch(voucher: { UUID: string }, vouchee: { UUID: string }, chatId: number) {
    if (voucher.UUID === vouchee.UUID) {
      return;
    }

    const session = this.props.driver.session();
    try {
      await this.saveUsers([voucher, vouchee], chatId);
      await session.run(
        `MATCH (voucher:User {UUID: $voucherUUID})-[e:VOUCHED_FOR {chatId: $chatId}]->(vouchee:User {UUID: $voucheeUUID})
        DELETE e;`,
        {
          voucherUUID: voucher.UUID,
          voucheeUUID: vouchee.UUID,
          chatId,
        }
      );
    } finally {
      session.close();
    }
  }

  async getChatShortestPath(start: { UUID: string; }, end: { UUID: string; }, chatId: number): Promise<UUID[]> {
    await this.saveUsers([start, end], chatId);

    if (start.UUID === end.UUID) {
      return [start.UUID];
    }

    const session = this.props.driver.session();
    try {
      const result = await session.run(
        `MATCH (start:User {UUID: $startUUID}), (end:User {UUID: $endUUID}),
          p = allShortestPaths((start)-[rel:VOUCHED_FOR*]->(end))
        WHERE ALL(rel in relationships(p) WHERE rel.chatId = $chatId)
        RETURN [node in nodes(p) | node.UUID] AS UUIDs;
        `,
        {
          startUUID: start.UUID,
          endUUID: end.UUID,
          chatId
        }
      );
      if (result.records.length <= 0) {
        return [];
      }
      return result.records[0].get('UUIDs') as UUID[];
    } finally {
      session.close();
    }
  }

  async getChatImmediateVouchersUUIDs({ UUID }: { UUID: string}, chatId: string): Promise<UUID[]> {
    const session = this.props.driver.session();
    try {
      const result = await session.run(
        `MATCH (vouchee:User {UUID: $UUID})<-[:VOUCHED_FOR {chatId: $chatId}]-(voucher:User)
        RETURN voucher.UUID AS UUID`,
        { UUID, chatId }
      );
      return result.records.map((record) => record.get('UUID'));
    } finally {
      session.close();
    }
  }

}