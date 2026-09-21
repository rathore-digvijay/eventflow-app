import { pgEnum, pgTable, timestamp, uuid, varchar, text } from "drizzle-orm/pg-core";
import { users } from "./users";

export const statusEnum = pgEnum('status', ['DRAFT', 'PUBLISHED', 'CANCELLED']);

export const events = pgTable('events', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    date: timestamp('date').notNull(),
    location: varchar('location', { length: 255 }).notNull(),
    status: statusEnum('status').notNull().default('DRAFT'),
    organiserId: uuid('organiser_id').notNull().references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;