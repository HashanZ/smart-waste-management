"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const express_validator_1 = require("express-validator");
const response_1 = require("../utils/response");
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => {
            if ('msg' in error) {
                return error.msg;
            }
            return 'Validation error';
        });
        response_1.ResponseHandler.badRequest(res, errorMessages.join(', '));
        return;
    }
    next();
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validateRequest.js.map