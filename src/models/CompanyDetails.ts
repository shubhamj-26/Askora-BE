import mongoose, { Schema } from "mongoose";
import { ICompanyDetails } from "../types/index.js";

const CompanyDetailsSchema = new Schema<ICompanyDetails>(
    {
        organizationName: { type: String, required: true },
        domainName: { type: String, required: true, unique: true },
        dbName: { type: String, required: true, unique: true },
        adminEmail: { type: String, required: true, unique: true },
    },
    { timestamps: true }
);

export const CompanyDetails = mongoose.model<ICompanyDetails>(
    "company_details",
    CompanyDetailsSchema
);