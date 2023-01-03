import { LoadDictElement } from "di-why/build/src/DiContainer";
import { driver } from "neo4j-driver";
import { Driver } from "neo4j-driver-core";
import { Env } from "./env";

const loadDictElement: LoadDictElement<Driver> = {
  factory: function ({ env }: { env: Env; }) {
    const { NEO4J_HOST, NEO4J_PORT_BOLT } = env;
    return driver(`bolt://${NEO4J_HOST}:${NEO4J_PORT_BOLT}`);
  },
  locateDeps: {
    env: 'env',
  }
}

export default loadDictElement;