import { 
  type Connection, 
  type InsertConnection, 
  type IceCandidate, 
  type InsertIceCandidate,
  type User, 
  type InsertUser 
} from "@shared/schema";

// Storage interface for the application
export interface IStorage {
  // Connection methods
  createConnection(connection: InsertConnection): Promise<Connection>;
  getConnection(id: number): Promise<Connection | undefined>;
  getConnectionByOfferer(offererId: string): Promise<Connection | undefined>;
  updateConnection(id: number, updates: Partial<Connection>): Promise<Connection | undefined>;
  
  // ICE Candidate methods
  addIceCandidate(candidate: InsertIceCandidate): Promise<IceCandidate>;
  getIceCandidates(connectionId: number): Promise<IceCandidate[]>;
  
  // User methods (preserved from template)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private connections: Map<number, Connection>;
  private iceCandidates: Map<number, IceCandidate>;
  private userIdCounter: number;
  private connectionIdCounter: number;
  private iceCandidateIdCounter: number;

  constructor() {
    this.users = new Map();
    this.connections = new Map();
    this.iceCandidates = new Map();
    this.userIdCounter = 1;
    this.connectionIdCounter = 1;
    this.iceCandidateIdCounter = 1;
  }

  // Connection methods
  async createConnection(connectionData: InsertConnection): Promise<Connection> {
    const id = this.connectionIdCounter++;
    const createdAt = new Date();
    const connection: Connection = { id, ...connectionData, createdAt };
    this.connections.set(id, connection);
    return connection;
  }

  async getConnection(id: number): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async getConnectionByOfferer(offererId: string): Promise<Connection | undefined> {
    return Array.from(this.connections.values()).find(
      connection => connection.offererSessionId === offererId
    );
  }

  async updateConnection(id: number, updates: Partial<Connection>): Promise<Connection | undefined> {
    const connection = this.connections.get(id);
    if (!connection) return undefined;
    
    const updatedConnection = { ...connection, ...updates };
    this.connections.set(id, updatedConnection);
    
    return updatedConnection;
  }

  // ICE Candidate methods
  async addIceCandidate(candidateData: InsertIceCandidate): Promise<IceCandidate> {
    const id = this.iceCandidateIdCounter++;
    const createdAt = new Date();
    const candidate: IceCandidate = { id, ...candidateData, createdAt };
    this.iceCandidates.set(id, candidate);
    return candidate;
  }

  async getIceCandidates(connectionId: number): Promise<IceCandidate[]> {
    return Array.from(this.iceCandidates.values()).filter(
      candidate => candidate.connectionId === connectionId
    );
  }

  // User methods (preserved from template)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
