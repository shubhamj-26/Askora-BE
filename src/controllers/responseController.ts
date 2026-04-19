import { Response as ExpressResponse } from "express";
import { AuthRequest } from "../types/index";
import { getOrgConnection } from "../config/database";
import { getResponseModel, getQuestionModel, getUserModel } from "../models/OrgModels";
import { triggerPusherEvent } from "../config/pusher";
import { Server as SocketServer } from "socket.io";

let ioInstance: SocketServer | null = null;

export const setSocketIo = (io: SocketServer): void => {
    ioInstance = io;
};

// ── Submit response ───────────────────────────────────────────────────────────
export const submitResponse = async (
    req: AuthRequest,
    res: ExpressResponse
): Promise<void> => {
    try {
        const { questionId, selectedOptionId } = req.body;
        const { userId, email, companyDbName } = req.user!;

        if (!questionId || !selectedOptionId) {
            res
                .status(400)
                .json({ success: false, message: "Question ID and selected option required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const QuestionModel = getQuestionModel(conn);
        const ResponseModel = getResponseModel(conn);

        const question = await QuestionModel.findById(questionId);
        if (!question) {
            res.status(404).json({ success: false, message: "Question not found" });
            return;
        }

        if (!question.isActive) {
            res.status(400).json({ success: false, message: "This question is no longer active" });
            return;
        }

        const selectedOption = question.options.find(
            (opt) => opt._id?.toString() === selectedOptionId
        );
        if (!selectedOption) {
            res.status(400).json({ success: false, message: "Invalid option selected" });
            return;
        }

        // Check duplicate
        const existingResponse = await ResponseModel.findOne({ questionId, userId });
        if (existingResponse) {
            res.status(409).json({
                success: false,
                message: "You have already responded to this question. You can edit your response.",
                data: { response: existingResponse },
            });
            return;
        }

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

        if (ioInstance) {
            ioInstance.to(companyDbName).emit("response:new", {
                questionId,
                response,
                userName: user?.name || email,
                selectedOptionText: selectedOption.text,
            });
        }

        await triggerPusherEvent(`org-${companyDbName}`, "response-new", {
            questionId,
            responseId: response._id,
            userName: user?.name || email,
            selectedOptionText: selectedOption.text,
        });

        console.log(`✅ Response submitted to question ${questionId} by ${user?.name || email}. Pusher event sent to org-${companyDbName}`);

        res.status(201).json({
            success: true,
            message: "Response submitted",
            data: { response },
        });
    } catch (error) {
        console.error("Submit response error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Update (edit) response ────────────────────────────────────────────────────
export const updateResponse = async (
    req: AuthRequest,
    res: ExpressResponse
): Promise<void> => {
    try {
        const { responseId } = req.params;
        const { selectedOptionId } = req.body;
        const { userId, companyDbName } = req.user!;

        if (!selectedOptionId) {
            res.status(400).json({ success: false, message: "selectedOptionId is required" });
            return;
        }

        const conn = getOrgConnection(companyDbName);
        const ResponseModel = getResponseModel(conn);
        const QuestionModel = getQuestionModel(conn);

        const existing = await ResponseModel.findOne({ _id: responseId, userId });
        if (!existing) {
            res.status(404).json({ success: false, message: "Response not found or not yours" });
            return;
        }

        const question = await QuestionModel.findById(existing.questionId);
        if (!question) {
            res.status(404).json({ success: false, message: "Question not found" });
            return;
        }

        const selectedOption = question.options.find(
            (opt) => opt._id?.toString() === selectedOptionId
        );
        if (!selectedOption) {
            res.status(400).json({ success: false, message: "Invalid option" });
            return;
        }

        existing.selectedOptionId = selectedOptionId;
        existing.selectedOptionText = selectedOption.text;
        await existing.save();

        if (ioInstance) {
            ioInstance.to(companyDbName).emit("response:updated", {
                questionId: existing.questionId,
                responseId,
                selectedOptionText: selectedOption.text,
            });
        }

        // Trigger Pusher event for updated response
        await triggerPusherEvent(`org-${companyDbName}`, "response-updated", {
            questionId: existing.questionId,
            responseId,
            selectedOptionText: selectedOption.text,
        });

        res.json({
            success: true,
            message: "Response updated",
            data: { response: existing },
        });
    } catch (error) {
        console.error("Update response error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Get responses for a question (admin) ─────────────────────────────────────
export const getResponses = async (
    req: AuthRequest,
    res: ExpressResponse
): Promise<void> => {
    try {
        const { questionId } = req.params;
        const { companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const ResponseModel = getResponseModel(conn);

        const responses = await ResponseModel.find({ questionId }).sort({ createdAt: -1 });
        res.json({ success: true, data: { responses } });
    } catch (error) {
        console.error("Get responses error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Get current user's response for one question ──────────────────────────────
export const getUserResponse = async (
    req: AuthRequest,
    res: ExpressResponse
): Promise<void> => {
    try {
        const { questionId } = req.params;
        const { userId, companyDbName } = req.user!;

        const conn = getOrgConnection(companyDbName);
        const ResponseModel = getResponseModel(conn);

        // Returns null if user hasn't answered — that's fine
        const response = await ResponseModel.findOne({ questionId, userId });
        res.json({ success: true, data: { response } });
    } catch (error) {
        console.error("Get user response error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Get all responses in org (admin) ─────────────────────────────────────────
export const getAllResponses = async (
    req: AuthRequest,
    res: ExpressResponse
): Promise<void> => {
    try {
        const { companyDbName } = req.user!;
        const conn = getOrgConnection(companyDbName);
        const ResponseModel = getResponseModel(conn);

        const responses = await ResponseModel.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: { responses } });
    } catch (error) {
        console.error("Get all responses error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};