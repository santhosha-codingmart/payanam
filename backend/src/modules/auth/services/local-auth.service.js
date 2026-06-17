import bCyrpt from "bcrypt";
import User from "../../users/models/user.model.js";

export const registerByEmail = async(userData)=>{
    const {email, password} = userData;
    
    if(!email){
        throw new Error("Email is required");
    }

    if(!password){
        throw new Error("Password is required");
    }

    if(await User.findOne({email:email})){
        throw new Error("Email is already Registered");
    }
    
    let BPass = await bCyrpt.hash(password,10);
    const createdUser = await User.create({
        email,
        password:BPass,
        authProvider: "local"
    });

    return createdUser;
    }

    export const loginByEmail = async(userData)=>{
        const {email,password}=userData;
        if(!email){
            throw new Error("Email is required");
        }
        if(!password){
            throw new Error("Password is required");
        }

        const existingUser = await User.findOne({email});
        if(!existingUser){
            throw new Error("Invalid credentials");
        }

        else{
            const success = await bCyrpt.compare(password,existingUser.password);
            if(success){
              
                return existingUser;
            }

            else{
                throw new Error("Wrong Password");
            }
        }
    }