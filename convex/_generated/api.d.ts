/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as appConfig from "../appConfig.js";
import type * as attendance from "../attendance.js";
import type * as classes from "../classes.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as lib_phone from "../lib/phone.js";
import type * as marketing from "../marketing.js";
import type * as payments from "../payments.js";
import type * as paymentsLib from "../paymentsLib.js";
import type * as permits from "../permits.js";
import type * as products from "../products.js";
import type * as repairs from "../repairs.js";
import type * as sales from "../sales.js";
import type * as seed from "../seed.js";
import type * as students from "../students.js";
import type * as timeSlots from "../timeSlots.js";
import type * as waha from "../waha.js";
import type * as wahaMedia from "../wahaMedia.js";
import type * as whatsapp from "../whatsapp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  appConfig: typeof appConfig;
  attendance: typeof attendance;
  classes: typeof classes;
  crm: typeof crm;
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/hmac": typeof lib_hmac;
  "lib/phone": typeof lib_phone;
  marketing: typeof marketing;
  payments: typeof payments;
  paymentsLib: typeof paymentsLib;
  permits: typeof permits;
  products: typeof products;
  repairs: typeof repairs;
  sales: typeof sales;
  seed: typeof seed;
  students: typeof students;
  timeSlots: typeof timeSlots;
  waha: typeof waha;
  wahaMedia: typeof wahaMedia;
  whatsapp: typeof whatsapp;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
