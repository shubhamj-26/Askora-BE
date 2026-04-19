import { Request } from "express";
import { Document, Types } from "mongoose";

export interface ICompanyDetails extends Document {
    organizationName: string;
    domainName: string;
    dbName: string;
    adminEmail: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUser {
    _id?: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    role: "admin" | "user";
    companyDbName: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IOption {
    _id?: Types.ObjectId;
    text: string;
    order: number;
}

export interface IQuestion extends Document {
    text: string;
    options: IOption[];
    isActive: boolean;
    createdBy: string;
    companyDbName: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IResponse extends Document {
    questionId: Types.ObjectId;
    userId: string;
    userEmail: string;
    userName: string;
    selectedOptionId: string;
    selectedOptionText: string;
    companyDbName: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ITokenRecord extends Document {
    userId: string;
    token: string;
    companyDbName: string;
    expiresAt: Date;
    createdAt?: Date;
}

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: "admin" | "user";
        companyDbName: string;
    };
}

export interface SignupPayload {
    name: string;
    email: string;
    password: string;
    organizationName: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}