// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
//  Copyright 2012 the V8 project authors. All rights reserved.
//  Use of this source code is governed by a BSD-style license that can be
//  found in the LICENSE.v8 file.

import { toAddress } from "#core/address.js";

export const kNoLineNumberInfo = 0;
export const kNoColumnInfo = 0;
export const kNoScriptInfo = 0;
export const kNoScriptId = 0;
export const kNoSourcePosition = -1;
export const kNotInlined = -1;
export const kNullAddress = toAddress(0);