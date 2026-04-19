import { Schema, Connection, Model } from "mongoose";
import { IUser, IQuestion, IResponse, ITokenRecord } from "../types/index";

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
    { timestamps: true }
);

// Option sub-schema
const OptionSchema = new Schema({
    text: { type: String, required: true },
    order: { type: Number, required: true },
});

// Question Schema
const QuestionSchema = new Schema<IQuestion>(
    {
        text: { type: String, required: true },
        options: { type: [OptionSchema], required: true },
        isActive: { type: Boolean, default: true },
        createdBy: { type: String, required: true },
        companyDbName: { type: String, required: true },
    },
    { timestamps: true }
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
    { timestamps: true }
);

// Token Schema
const TokenSchema = new Schema<ITokenRecord>(
    {
        userId: { type: String, required: true },
        token: { type: String, required: true },
        companyDbName: { type: String, required: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

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