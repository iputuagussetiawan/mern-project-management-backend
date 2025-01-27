import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { createWorkspaceSchema } from "../validation/workspace.validation";
import { createWorkspaceService, getAllWorkspacesUserIsMemberService } from "../services/workspace.service";
import { HTTPSTATUS } from "../config/http.config";

export const createWorkspaceController = asyncHandler(
    async (req: Request, res: Response) => {
        const body = createWorkspaceSchema.parse(req.body);
        const userId = req.user?._id;
        const { workspace } = await createWorkspaceService(userId, body);
        return res.status(HTTPSTATUS.CREATED).json({
            message: "Workspace created successfully",
            workspace,
        });
    }
);

// Controller: Get all workspaces the user is part of
export const getAllWorkspacesUserIsMemberController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const { workspaces } = await getAllWorkspacesUserIsMemberService(userId);
        return res.status(HTTPSTATUS.OK).json({
            message: "User workspaces fetched successfully",
            workspaces,
        });
    }
);