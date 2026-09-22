import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres/driver';
import { Pool } from 'pg';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private pool: Pool;
    public db: NodePgDatabase<typeof schema>;

    constructor() {
        const connectionString = process.env.DATABASE_URL!;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }
        this.pool = new Pool({
            connectionString,
        });
        this.db = drizzle(this.pool, { schema });

        console.log('Database connection established');
    }

    async onModuleDestroy() {
        await this.pool.end();
        console.log('Database connection closed');
    }

    getSchema() {
        return schema;
    }
}
