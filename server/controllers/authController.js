import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import transporter  from '../config/nodemailer.js';
// import NotepadModel from "../models/notepadModel.js";

export const register =async (req,res) =>{
    const {name,email,password} = req.body;
    if(!name || !email ||!password){
        return res.json({success:false,message: 'Missing Details'})
    }
    try{
        const existingUser = await userModel.findOne({email})
        if(existingUser){
            return res.json({success: false,message:"User already exists"});
        }

        const hashedPassword = await bcrypt.hash(password,10);
        const user = new userModel({name,email,password:hashedPassword});

        const token = jwt.sign({id: user._id},process.env.JWT_SECRET,{expiresIn:'7d'});
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', 
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        console.log("Your Token : " +token)

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        console.log(otp);
        user.verifyOtp = otp;
        user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();
        
        //Semding email
        const  mailOption = {
            from:process.env.SENDER_EMAIL,
            to: email,
            subject:'Welcome to feelverse',
            text:`Welcome to feelverse,You account has been created with email id: ${email}
            
            Account Verification OTP
            Your OTP is ${otp}. Verify your account using this OTP.`
        }
        await transporter.sendMail(mailOption);
        
        return res.json({success:true});
    }catch(error){
        res.json({success:false, message: error.message})
    }
    
}

export const verifyEmail = async (req, res) => {
    const {email,otp} =req.body;
    if (!email || !otp) {
        return res.json({ success: false, message: 'Missing details' });
    }
    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (user.verifyOtp==='' || user.verifyOtp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }

        if (user.verifyOtpExpireAt < Date.now()) {
            return res.json({ success: false, message: 'OTP expired' });
        }

        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpireAt = 0;

        await user.save();

        return res.json({ success: true, message: 'Email verified successfully' });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const login =async(req,res) =>{
    const { email, password } = req.body;
    if(!email || !password){
        return res.json({success:false,message: 'Emai l and password are required'})
    }
    try{
        const user = await userModel.findOne({email});
    if(!user){
        return res,json({success: false,message:'Invalid email'})
    }
    const isMatch = await bcrypt.compare(password,user.password);

    if(!isMatch){
        return res,json({success: false,message:'Invalid password'})
    }

    const token = jwt.sign({id: user._id},process.env.JWT_SECRET,{expiresIn:'7d'});
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
        console.log("Your Token : " +token)
        return res.json({success: true});
    } catch(error){
        return res.json({ success: false, message: error.message});
    }
}

export const logout = async(req,res)=>{
    try {
        res.clearCookie('token',{
            httpOnly:true,
            secure: process.env.NODE_ENV === 'production',
            sameSite:process.env.NODE_ENV === 'production' ?
            'none' : 'strict',
        })
        return res.json({ success: true, message:"Logged Out"});

    }catch (error){
        return res.json({ success: false, message: error.message});
    }
}


export const verifyOTPreset = async (req, res) => {
    const {email,otp} =req.body;
    if (!email || !otp) {
        return res.json({ success: false, message: 'Missing details' });
    }
    try {
        const user = await userModel.findOne({ email });
        console.log(otp)
        console.log(email)
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (user.resetOtp==='' || user.resetOtp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }

        if (user.resetOtpExpireAt < Date.now()) {
            return res.json({ success: false, message: 'OTP expired' });
        }
        return res.json({ success: true, message: 'OTP Verify' , email});

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};


//check if user is authenticated
export const isAuthenticated = async(req,res)=>{
    try{
        return res.json({success:true});
    }catch(error){
       res.json({ success: false, message: error.message });
    }
}

//send Password reset OTP
export const sendResetOtp = async(req,res)=>{
    const {email} = req.body;
    console.log(email);
    if(!email){
        return res.json({success: false, message: 'Email is required'})
    }
    try{
        const user =await userModel.findOne({email});
        if(!user){
            return res.json({success: false,message:'User not found'});
        }
        const otp = String(Math.floor(100000 + Math.random() * 900000));

       
        user.resetOtp = otp;
        user. resetOtpExpireAt = Date.now() + 15 * 60 * 1000;

        await user.save();

        const mailOption = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Password Reset OTP',
            text: `Your OTP for resetting your password is ${otp}. use this OTP to proced with resetting your password.`
        };

        await transporter.sendMail(mailOption);
        return res.json({success: true, message: 'OTP sent to your email'});

    }catch(error){
        return res.json({ success: false, message: error.message });
    }
}

//Reset user password
export const resetPassword = async(req,res)=>{
    const {email,otp,newPassword}=req.body;

    if(!email || !otp || !newPassword){
        return res.json({success:false,message:'Email,OTP,and new password are required'});
    }
    try{

        const user = await userModel.findOne({email});
        if(!user){
            return res.json({ success: false, message: 'User not found' });
        }
        if(user.resetOtp === ""|| user.resetOtp !== otp){
            return res.json({ success: false, message: 'Invalid OTP' });
        }
        if(user.resetOtpExpireAt < Date.now()){
            return res.json({ success: false, message: 'OTP Epired' });
        }

        const hashedPassword = await bcrypt.hash(newPassword,10);

        user.password = hashedPassword;
        user.resetOtp = '';
        user.resetOtpExpireAt = 0;

        await user.save();

        return res.json({ success: true, message: 'Password has been reset successfully' });


    }catch(error){
        return res.json({ success: false, message: error.message });
    }
}

// export const NotepadData = async(req,res)=>{
//     const {userId,date,note,emoji}=req.body;
//     if(!date || !note || !emoji){
//         return res.json({success:false,message:'date,note,and new emoji are required'});
//     }
//     try{
    
//     const user =await userModel.findOne({userId});
//     if(!user){
//         return res.json({success: false,message:'User not found'});
//     }

//     const newNote = new NotepadModel({
//         userId,
//         date,
//         note,
//         emoji
//     });

//     await newNote.save();
//     return res.json({ success: true, message: 'Note saved successfully', data: newNote });

//     }catch{
//         return res.json({ success: false, message: error.message });
//     }
// }