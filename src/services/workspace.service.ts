import mongoose from "mongoose";
import { Roles } from "../enums/role.enum";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import UserModel from "../models/user.model";
import WorkspaceModel from "../models/workspace.model";
import { NotFoundException } from "../utils/appError";
import TaskModel from "../models/task.model";
import { TaskStatusEnum } from "../enums/task.enum";

//********************************
// CREATE NEW WORKSPACE
//**************** **************/
export const createWorkspaceService = async (
    userId: string,
    body: {
        name: string;
        description?: string | undefined;
    }
) => {
    const { name, description } = body;
    //check user exists or not
    const user = await UserModel.findById(userId);
    //jika user tidak ditemukan, maka tampilkan error
    if (!user) {
        throw new NotFoundException("User not found");
    }
    //check owner role
    const ownerRole = await RoleModel.findOne({ name: Roles.OWNER });
    //jika owner role tidak ditemukan, maka tampilkan error
    if (!ownerRole) {
        throw new NotFoundException("Owner role not found");
    }

    //buat workspace
    const workspace = new WorkspaceModel({
        name: name,
        description: description,
        owner: user._id,
    });
    //simpan workspace
    await workspace.save();
    const member = new MemberModel({
        userId: user._id,
        workspaceId: workspace._id,
        role: ownerRole._id,
        joinedAt: new Date(),
    });
    await member.save();
    user.currentWorkspace = workspace._id as mongoose.Types.ObjectId;
    await user.save();
    return {
        workspace,
    };
};

//********************************
// GET WORKSPACES USER IS A MEMBER
//**************** **************/
export const getAllWorkspacesUserIsMemberService = async (userId: string) => {
    const memberships = await MemberModel.find({ userId })
    .populate("workspaceId")
    .select("-password")
    .exec();
    // Extract workspace details from memberships
    const workspaces = memberships.map((membership) => membership.workspaceId);
    return { workspaces };
};

//********************************
// UPDATE WORKSPACE
//**************** **************/
export const updateWorkspaceByIdService = async (
    workspaceId: string,
    name: string,
    description?: string
) => {
    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) {
        throw new NotFoundException("Workspace not found");
    }
    // Update the workspace details
    workspace.name = name || workspace.name;
    workspace.description = description || workspace.description;
    await workspace.save();
    return {
        workspace,
    };
};

export const getWorkspaceByIdService = async (workspaceId: string) => {
    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) {
        throw new NotFoundException("Workspace not found");
    }
    const members = await MemberModel.find({
        workspaceId,
    }).populate("role");
    const workspaceWithMembers = {
        ...workspace.toObject(),
        members,
    };
    return {
        workspace: workspaceWithMembers,
    };
};

//********************************
// GET ALL MEMEBERS IN WORKSPACE
//**************** **************/
export const getWorkspaceMembersService = async (workspaceId: string) => {
    // Fetch all members of the workspace
    const members = await MemberModel.find({
        workspaceId,
    })
    .populate("userId", "name email profilePicture -password")
    .populate("role", "name");
    const roles = await RoleModel.find({}, { name: 1, _id: 1 })
        .select("-permission")
        .lean();
    return { members, roles };
};

export const getWorkspaceAnalyticsService = async (workspaceId: string) => {
    const currentDate = new Date();
    const totalTasks = await TaskModel.countDocuments({
        workspace: workspaceId,
    });
    const overdueTasks = await TaskModel.countDocuments({
        workspace: workspaceId,
        dueDate: { $lt: currentDate },
        status: { $ne: TaskStatusEnum.DONE },
    });
    const completedTasks = await TaskModel.countDocuments({
        workspace: workspaceId,
        status: TaskStatusEnum.DONE,
    });
    const analytics = {
        totalTasks,
        overdueTasks,
        completedTasks,
    };
    return { analytics };
};

export const changeMemberRoleService = async (
    workspaceId: string,
    memberId: string,
    roleId: string
) => {
    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) {
        throw new NotFoundException("Workspace not found");
    }
    const role = await RoleModel.findById(roleId);
    if (!role) {
        throw new NotFoundException("Role not found");
    }
    const member = await MemberModel.findOne({
        userId: memberId,
        workspaceId: workspaceId,
    });
    if (!member) {
        throw new Error("Member not found in the workspace");
    }
    member.role = role;
    await member.save();
    return {
        member,
    };
};

