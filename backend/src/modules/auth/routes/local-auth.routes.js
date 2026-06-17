import express from "express";

import {login,refresh,register} from "../controllers/local-auth.controller.js";

let router = express.Router();


router.post('/register',register);
router.post('/login',login);
router.post('/refresh',refresh);

export default router;