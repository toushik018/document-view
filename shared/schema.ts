import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// WebRTC Connection schema
export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  offererSessionId: text("offerer_session_id").notNull(),
  answererSessionId: text("answerer_session_id"),
  offer: text("offer"),
  answer: text("answer"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConnectionSchema = createInsertSchema(connections).pick({
  offererSessionId: true,
  answererSessionId: true,
  offer: true,
  answer: true,
  status: true,
});

export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

// WebRTC ICE candidate schema
export const iceCandidates = pgTable("ice_candidates", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  candidate: text("candidate").notNull(),
  sender: text("sender").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIceCandidateSchema = createInsertSchema(iceCandidates).pick({
  connectionId: true,
  candidate: true,
  sender: true,
});

export type InsertIceCandidate = z.infer<typeof insertIceCandidateSchema>;
export type IceCandidate = typeof iceCandidates.$inferSelect;

// Users remain in the schema from the template
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
