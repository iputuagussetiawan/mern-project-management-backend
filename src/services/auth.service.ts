import mongoose from "mongoose";
import UserModel from "../models/user.model";
import AccountModel from "../models/account.model";
import WorkspaceModel from "../models/workspace.model";
import RoleModel from "../models/roles-permission.model";
import { Roles } from "../enums/role.enum";
import {
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
} from "../utils/appError";
import MemberModel from "../models/member.model";
import { ProviderEnum } from "../enums/account-provider.enum";

export const loginOrCreateAccountService = async (data: {
    provider: string;
    displayName: string;
    providerId: string;
    picture?: string;
    email?: string;
}) => {
    const { providerId, provider, displayName, email, picture } = data;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        console.log("Started Session...");

        //check user on db
        let user = await UserModel.findOne({ email }).session(session);

        //jika tidak ada user, maka buat user baru
        if (!user) {
            //buat user baru
            user = new UserModel({
                email,
                name: displayName,
                profilePicture: picture || null,
            });
            await user.save({ session });

            //buat akun baru
            const account = new AccountModel({
                userId: user._id,
                provider: provider,
                providerId: providerId,
            });
            await account.save({ session });

            // buat workspace baru untuk user baru
            const workspace = new WorkspaceModel({
                name: `My Workspace`,
                description: `Workspace created for ${user.name}`,
                owner: user._id,
            });
            await workspace.save({ session });

            const ownerRole = await RoleModel.findOne({
                name: Roles.OWNER,
            }).session(session);

            if (!ownerRole) {
                throw new NotFoundException("Owner role not found");
            }

            //buat member baru untuk workspace
            const member = new MemberModel({
                userId: user._id,
                workspaceId: workspace._id,
                role: ownerRole._id,
                joinedAt: new Date(),
            });
            await member.save({ session });

            user.currentWorkspace = workspace._id as mongoose.Types.ObjectId;
            await user.save({ session });
        }
        await session.commitTransaction();
        session.endSession();
        console.log("End Session...");

        return { user };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    } finally {
        session.endSession();
    }
};

export const registerUserService = async (body: {
    email: string;
    name: string;
    password: string;
}) => {
    const { email, name, password } = body;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        console.log("Started Session...");
        //check user on db
        const existingUser = await UserModel.findOne({ email }).session(session);
        //jika ada user, maka tampilkan error
        if (existingUser) {
            throw new BadRequestException("Email already exists");
        }
        //buat user baru dengan password
        const user = new UserModel({
            email,
            name,
            password,
        });
        await user.save({ session });

        //buat account baru untuk user
        const account = new AccountModel({
            userId: user._id,
            provider: ProviderEnum.EMAIL,
            providerId: email,
        });
        await account.save({ session });

        // buat workspace baru untuk user
        const workspace = new WorkspaceModel({
            name: `My Workspace`,
            description: `Workspace created for ${user.name}`,
            owner: user._id,
        });
        await workspace.save({ session });

        //check owner role
        const ownerRole = await RoleModel.findOne({
            name: Roles.OWNER,
        }).session(session);

        //jika owner role tidak ditemukan, maka tampilkan error
        if (!ownerRole) {
            throw new NotFoundException("Owner role not found");
        }

        //buat member baru untuk workspace
        const member = new MemberModel({
            userId: user._id,
            workspaceId: workspace._id,
            role: ownerRole._id,
            joinedAt: new Date(),
        });
        await member.save({ session });

        //update currentWorkspace di user
        user.currentWorkspace = workspace._id as mongoose.Types.ObjectId;
        await user.save({ session });
        await session.commitTransaction();
        session.endSession();
        console.log("End Session...");
        return {
            userId: user._id,
            workspaceId: workspace._id,
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

export const verifyUserService = async ({
    email,
    password,
    provider = ProviderEnum.EMAIL,
}: {
    email: string;
    password: string;
    provider?: string;
    }) => {
    //check account di database dengan pencocokan email
    const account = await AccountModel.findOne({ provider, providerId: email });

    //jika account tidak ditemukan, maka tampilkan error
    if (!account) {
        throw new NotFoundException("Invalid email or password");
    }

    //check password
    const user = await UserModel.findById(account.userId);
    //jika user tidak ditemukan, maka tampilkan error
    if (!user) {
        throw new NotFoundException("User not found for the given account");
    }

    //check password
    const isMatch = await user.comparePassword(password);
    //jika password tidak cocok, maka tampilkan error
    if (!isMatch) {
        throw new UnauthorizedException("Invalid email or password");
    }
    return user.omitPassword();
};