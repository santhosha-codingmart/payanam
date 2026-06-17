import mongoose from "mongoose";

let userSchema = mongoose.Schema({
    name:{
        type:String,
        trim:true,
        sparse: true
    },

    age:{
        type:Number,
        trim: true,
        sparse: true
    },

    email:{
        type:String,
        sparse: true,
        trim: true,
        unique: true
    },

    phoneNo:{
        type:String,
        sparse:true,
        trim: true,
        unique: true
    },

    isEmailVerified:{
        type: Boolean,
        default:false
    },

    isPhoneVerified:{
        type:Boolean,
        default: false
    },

    password:{
        type: String
    },

    role:{
        type: String,
        enum:["user","vendor","admin"],
        default:"user"
    }
},{
    timestamps:  true
});

const User = mongoose.model('User',userSchema);
export default User;