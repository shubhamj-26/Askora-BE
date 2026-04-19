import { Schema, Connection, Model } from "mongoose";
import { IUser, IQuestion, IResponse, ITokenRecord } from "../types/index";

// ── Shared schema options: expose virtual 'id', hide __v ─────────────────────
const schemaOptions = {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc: unknown, ret: Record<string, unknown>) => {
            ret.id = ret._id?.toString();
            delete ret.__v;
        },
    },
    toObject: { virtuals: true },
};

// User Schema
const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, enum: ["admin", "user"], default: "user" },
        companyDbName: { type: String, required: true },
        isActive: { type: Boolean, default: true },
    },
    schemaOptions
);

// Option sub-schema
const OptionSchema = new Schema(
    {
        text: { type: String, required: true },
        order: { type: Number, required: true },
    },
    { toJSON: { virtuals: true } }
);

// Question Schema
const QuestionSchema = new Schema<IQuestion>(
    {
        text: { type: String, required: true },
        options: { type: [OptionSchema], required: true },
        isActive: { type: Boolean, default: true },
        createdBy: { type: String, required: true },
        companyDbName: { type: String, required: true },
    },
    schemaOptions
);

// Response Schema
const ResponseSchema = new Schema<IResponse>(
    {
        questionId: { type: Schema.Types.ObjectId, required: true, ref: "questions" },
        userId: { type: String, required: true },
        userEmail: { type: String, required: true },
        userName: { type: String, required: true },
        selectedOptionId: { type: String, required: true },
        selectedOptionText: { type: String, required: true },
        companyDbName: { type: String, required: true },
    },
    schemaOptions
);

// Token Schema
const TokenSchema = new Schema<ITokenRecord>(
    {
        userId: { type: String, required: true },
        token: { type: String, required: true },
        refreshToken: { type: String },
        companyDbName: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        refreshExpiresAt: { type: Date },
    },
    schemaOptions
);

// Chat Message Schema — supports both team and personal chat
const ChatMessageSchema = new Schema(
    {
        companyDbName: { type: String, required: true },
        chatType: { type: String, enum: ["team", "personal"], default: "team" },
        senderId: { type: String, required: true },
        senderName: { type: String, required: true },
        senderEmail: { type: String, required: true },
        // Personal chat fields
        receiverId: { type: String, default: null },
        receiverName: { type: String, default: null },
        message: { type: String, required: true },
        readBy: [{ type: String }], // array of userIds
    },
    schemaOptions
);

// Index for fast personal chat queries
ChatMessageSchema.index({ companyDbName: 1, chatType: 1 });
ChatMessageSchema.index({ senderId: 1, receiverId: 1 });
ChatMessageSchema.index({ receiverId: 1, senderId: 1 });

// Model factories using org-specific connections
export const getUserModel = (conn: Connection): Model<IUser> => {
    return conn.models["users"] || conn.model<IUser>("users", UserSchema);
};

export const getQuestionModel = (conn: Connection): Model<IQuestion> => {
    return conn.models["questions"] || conn.model<IQuestion>("questions", QuestionSchema);
};

export const getResponseModel = (conn: Connection): Model<IResponse> => {
    return conn.models["responses"] || conn.model<IResponse>("responses", ResponseSchema);
};

export const getTokenModel = (conn: Connection): Model<ITokenRecord> => {
    return conn.models["tokens"] || conn.model<ITokenRecord>("tokens", TokenSchema);
};

export const getChatMessageModel = (conn: Connection) => {
    return conn.models["chat_messages"] || conn.model("chat_messages", ChatMessageSchema);
};