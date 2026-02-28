import { Response } from "express";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getQuestionModel, getResponseModel } from "../models/OrgModels";
import { triggerPusherEvent } from "../config/pusher";
import { Server as SocketServer } from "socket.io";

let ioInstance: SocketServer | null = null;

export const setSocketIo = (io: SocketServer): void => {
    ioInstance = io;
};

export const createQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { text, options } = req.body;
        const { companyDbName, email } = req.user!;

        if (!text || !options || !Array.isArray(options) || options.length < 2) {
            res.status(400).json({ success: false, message: "Question text and at least 2 options required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);

        const formattedOptions = options.map((opt: { text: string }, idx: number) => ({
            text: opt.text,
            order: idx + 1,
        }));

        const question = await QuestionModel.create({
            text,
            options: formattedOptions,
            isActive: true,
            createdBy: email,
            companyDbName,
        });

        // Emit via Socket.IO
        if (ioInstance) {
            ioInstance.to(companyDbName).emit("question:new", { question });
        }

        // Pusher real-time event
        await triggerPusherEvent(`org-${companyDbName}`, "question-new", { question });

        res.status(201).json({ success: true, message: "Question created", data: { question } });
    } catch (error) {
        console.error("Create question error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getQuestions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { companyDbName } = req.user!;
        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);

        const questions = await QuestionModel.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: { questions } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { companyDbName } = req.user!;
        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);

        const question = await QuestionModel.findById(id);
        if (!question) {
            res.status(404).json({ success: false, message: "Question not found" });
            return;
        }
        res.json({ success: true, data: { question } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { text, options, isActive } = req.body;
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);

        const updateData: Record<string, unknown> = {};
        if (text !== undefined) updateData.text = text;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (options && Array.isArray(options)) {
            updateData.options = options.map((opt: { text: string }, idx: number) => ({
                text: opt.text,
                order: idx + 1,
            }));
        }

        const question = await QuestionModel.findByIdAndUpdate(id, updateData, { new: true });
        if (!question) {
            res.status(404).json({ success: false, message: "Question not found" });
            return;
        }

        if (ioInstance) {
            ioInstance.to(companyDbName).emit("question:updated", { question });
        }
        await triggerPusherEvent(`org-${companyDbName}`, "question-updated", { question });

        res.json({ success: true, message: "Question updated", data: { question } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);

        await QuestionModel.findByIdAndDelete(id);

        if (ioInstance) {
            ioInstance.to(companyDbName).emit("question:deleted", { questionId: id });
        }

        res.json({ success: true, message: "Question deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getQuestionStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);
        const ResponseModel = getResponseModel(conn);

        const question = await QuestionModel.findById(id);
        if (!question) {
            res.status(404).json({ success: false, message: "Question not found" });
            return;
        }

        const responses = await ResponseModel.find({ questionId: id });

        const stats = question.options.map((opt) => {
            const count = responses.filter((r) => r.selectedOptionId === opt._id?.toString()).length;
            return {
                optionId: opt._id,
                optionText: opt.text,
                count,
                percentage: responses.length > 0 ? Math.round((count / responses.length) * 100) : 0,
            };
        });

        res.json({
            success: true,
            data: {
                question,
                totalResponses: responses.length,
                stats,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};