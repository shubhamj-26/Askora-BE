import { Response as ExpressResponse } from "express";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getResponseModel, getQuestionModel } from "../models/OrgModels";
import { triggerPusherEvent } from "../config/pusher";
import { Server as SocketServer } from "socket.io";

let ioInstance: SocketServer | null = null;

export const setSocketIo = (io: SocketServer): void => {
    ioInstance = io;
};

export const submitResponse = async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
        const { questionId, selectedOptionId } = req.body;
        const { userId, email, companyDbName } = req.user!;

        if (!questionId || !selectedOptionId) {
            res.status(400).json({ success: false, message: "Question ID and selected option required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);
        const ResponseModel = getResponseModel(conn);

        // Get question + validate option
        const question = await QuestionModel.findById(questionId);
        if (!question) {
            res.status(404).json({ success: false, message: "Question not found" });
            return;
        }

        const selectedOption = question.options.find(
            (opt) => opt._id?.toString() === selectedOptionId
        );
        if (!selectedOption) {
            res.status(400).json({ success: false, message: "Invalid option selected" });
            return;
        }

        // Check if user already responded
        const existingResponse = await ResponseModel.findOne({ questionId, userId });
        if (existingResponse) {
            res.status(409).json({ success: false, message: "You have already responded to this question" });
            return;
        }

        // Get user name from DB
        const { getUserModel } = await import("../models/OrgModels");
        const UserModel = getUserModel(conn);
        const user = await UserModel.findById(userId);

        const response = await ResponseModel.create({
            questionId,
            userId,
            userEmail: email,
            userName: user?.name || email,
            selectedOptionId,
            selectedOptionText: selectedOption.text,
            companyDbName,
        });

        // Real-time updates
        if (ioInstance) {
            ioInstance.to(companyDbName).emit("response:new", {
                questionId,
                response,
                selectedOptionText: selectedOption.text,
            });
        }
        await triggerPusherEvent(`org-${companyDbName}`, "response-new", {
            questionId,
            responseId: response._id,
            userName: user?.name || email,
            selectedOptionText: selectedOption.text,
        });

        res.status(201).json({ success: true, message: "Response submitted", data: { response } });
    } catch (error) {
        console.error("Submit response error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getResponses = async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
        const { questionId } = req.params;
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const ResponseModel = getResponseModel(conn);

        const responses = await ResponseModel.find({ questionId }).sort({ createdAt: -1 });
        res.json({ success: true, data: { responses } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserResponse = async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
        const { questionId } = req.params;
        const { userId, companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const ResponseModel = getResponseModel(conn);

        const response = await ResponseModel.findOne({ questionId, userId });
        res.json({ success: true, data: { response } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllResponses = async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
        const { companyDbName } = req.user!;
        const conn = getOrgConnection(companyDbName);
        const ResponseModel = getResponseModel(conn);

        const responses = await ResponseModel.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: { responses } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};