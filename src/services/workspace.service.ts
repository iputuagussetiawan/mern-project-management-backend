import mongoose from "mongoose";
import { Roles } from "../enums/role.enum";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import UserModel from "../models/user.model";
import WorkspaceModel from "../models/workspace.model";
import { NotFoundException } from "../utils/appError";

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

