import { Driver } from "neo4j-driver-core";
import { UUID } from "../types";

export default class GraphUserModel {

  public constructor(private props: { driver: Driver }) {}

  async saveUser({ UUID }: { UUID: string; }): Promise<number> {
    const session = this.props.driver.session();
    try {
      // Check if the user already exists
      const result = await session.run(
        'MATCH (user:User {UUID: $UUID}) RETURN user',
        {
          UUID,
        }
      );

      if (result.records.length > 0) {
        // If the user already exists, do nothing
        console.log(`User "${UUID}" already exists`);
        return result.records.length;
      }

      // If the user does not exist, create a new user node
      await session.run(
        'CREATE (user:User {UUID: $UUID}) RETURN user',
        { UUID }
      );

      console.log(`User "${UUID}" created`);
      return 0;
    } finally {
      session.close();
    }
  }

  async saveUsers(users: { UUID: string; }[]) {
    await Promise.all(users.map(u => this.saveUser(u)));
  }

  async saveVouch(voucher: { UUID: string }, vouchee: { UUID: string }) {
    const session = this.props.driver.session();
    try {
      // Check if both users exist
      await this.saveUsers([voucher, vouchee]);

      // Create a friendship relationship between the two users
      await session.run(
        'MATCH (voucher:User {UUID: $voucherUUID}), (vouchee:User {UUID: $voucheeUUID}) CREATE (voucher)-[:VOUCHED_FOR]->(vouchee)',
        {
          voucherUUID: voucher.UUID,
          voucheeUUID: vouchee.UUID,
        }
      );

      console.log(`Vouch, saved between "${voucher.UUID}" and "${vouchee.UUID}" created`);
    } finally {
      session.close();
    }
  }

  async saveUnvouch(voucher: { UUID: string }, vouchee: { UUID: string }) {
    const session = this.props.driver.session();
    try {
      // Check if both users exist
      await this.saveUsers([voucher, vouchee]);

      // Create a friendship relationship between the two users
      await session.run(
        `MATCH (voucher:User {UUID: $voucherUUID})-[e:VOUCHED_FOR]->(vouchee:User {UUID: $voucheeUUID})
        DELETE e;`,
        {
          voucherUUID: voucher.UUID,
          voucheeUUID: vouchee.UUID,
        }
      );

      console.log(`Unvouch, removed vouch between "${voucher.UUID}" and "${vouchee.UUID}"`);
    } finally {
      session.close();
    }
  }

  async getShortestPath(start: { UUID: string; }, end: { UUID: string; } ): Promise<UUID[]> {
    const session = this.props.driver.session();

    await this.saveUsers([start, end]);

    try {
      const result = await session.run(
        `MATCH (start:User {UUID: $start}), (end:User {UUID: $end}),
          p = allShortestPaths((start)-[:VOUCHED_FOR*]->(end))
        RETURN [node in nodes(p) | node.UUID] AS UUIDs;`,
        {
          start: start.UUID,
          end: end.UUID
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

  async getImmediateVouchersUUIDs({ UUID }: { UUID: string; }): Promise<UUID[]> {
    const session = this.props.driver.session();
    try {
      // Find the user with the given name
      const result = await session.run(
        'MATCH (vouchee:User {UUID: $UUID})<-[:VOUCHED_FOR]-(voucher:User) RETURN voucher.UUID AS UUID',
        { UUID }
      );
      return result.records.map((record) => record.get('UUID'));
    } finally {
      session.close();
    }
  }

}