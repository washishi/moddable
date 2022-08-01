#include "xsAll.h"		//@@ add copyright notice!
#include "xsScript.h"

static txBoolean fx_deepEqualEntries(txMachine* the, txSlot* limit, txBoolean strict, txBoolean paired);
static txBoolean fx_deepEqualInstances(txMachine* the, txSlot* limit, txBoolean strict);
static txBoolean fx_deepEqualProperties(txMachine* the, txSlot* limit, txBoolean strict, txID id);
static txBoolean fx_deepEqualSlots(txMachine* the, txSlot* limit, txBoolean strict);

void fx_deepEqual(txMachine* the)
{
	txSlot* limit = the->stack;
	txBoolean strict = 0;
	if (mxArgc > 0)
		mxPushSlot(mxArgv(0));
	else
		mxPushUndefined();
	if (mxArgc > 1)
		mxPushSlot(mxArgv(1));
	else
		mxPushUndefined();
	if (mxArgc > 2)
		strict = fxToBoolean(the, mxArgv(2));
	mxResult->value.boolean = fx_deepEqualSlots(the, limit, strict);
	mxResult->kind = XS_BOOLEAN_KIND;
	mxPop();
	mxPop();
}

txBoolean fx_deepEqualEntries(txMachine* the, txSlot* limit, txBoolean strict, txBoolean paired)
{
	txSlot* leftInstance = (the->stack + 1)->value.reference;
	txSlot* letfTable = leftInstance->next;
	txSlot* leftList = letfTable->next;
	txSlot* leftProperty;
	txSlot* rightInstance = the->stack->value.reference;
	txSlot* rightTable = rightInstance->next;
	txSlot* rightList = rightTable->next;
	txSlot* rightProperty;
	txSlot* rightBase;
	txSlot** rightAddress;
	txBoolean result;
	if (leftList->next->value.integer != rightList->next->value.integer)
		return 0;
		
	mxPushList();
	rightBase = the->stack;
	leftProperty = rightList->value.list.first;
	rightAddress = &(rightBase->value.list.first);
	while (leftProperty) {
		rightProperty = *rightAddress = fxDuplicateSlot(the, leftProperty);
		leftProperty = leftProperty->next;
		rightAddress = &(rightProperty->next);
	}
			
	leftProperty = leftList->value.list.first;
	while (leftProperty) {
		rightAddress = &(rightBase->value.list.first);
		while ((rightProperty = *rightAddress)) {
			mxPushSlot(leftProperty);
			mxPushSlot(rightProperty);
			result = fx_deepEqualSlots(the, limit, strict);
			mxPop();
			mxPop();
			if (paired) {
				if (result) {
					mxPushSlot(leftProperty->next);
					mxPushSlot(rightProperty->next);
					result &= fx_deepEqualSlots(the, limit, strict);
					mxPop();
					mxPop();
				}
				if (result) {
					*rightAddress = rightProperty->next->next;
					break;
				}
				rightAddress = &(rightProperty->next->next);
			}
			else {
				if (result) {
					*rightAddress = rightProperty->next;
					break;
				}
				rightAddress = &(rightProperty->next);
			}
		} 
		if (!rightProperty)
			return 0;
		leftProperty = leftProperty->next;
		if (paired)
			leftProperty = leftProperty->next;
	}
	mxPop();
	return 1;
}

txBoolean gxSpecialKinds[XS_STATIC_MODULE_RECORD_KIND + 1] = {
	0, // XS_UNDEFINED_KIND
	0, // XS_NULL_KIND
	1, // XS_BOOLEAN_KIND
	0, // XS_INTEGER_KIND
	1, // XS_NUMBER_KIND
	1, // XS_STRING_KIND
	1, // XS_STRING_X_KIND
	1, // XS_SYMBOL_KIND
	1, // XS_BIGINT_KIND
	1, // XS_BIGINT_X_KIND
	
	0, // XS_REFERENCE_KIND
	
	0, // XS_CLOSURE_KIND 
	0, // XS_FRAME_KIND

	0, // XS_INSTANCE_KIND
	
	0, // XS_ARGUMENTS_SLOPPY_KIND
	0, // XS_ARGUMENTS_STRICT_KIND
	1, // XS_ARRAY_KIND
	1, // XS_ARRAY_BUFFER_KIND
	1, // XS_CALLBACK_KIND
	1, // XS_CODE_KIND
	1, // XS_CODE_X_KIND
	1, // XS_DATE_KIND
	1, // XS_DATA_VIEW_KIND
	0, // XS_FINALIZATION_CELL_KIND
	0, // XS_FINALIZATION_REGISTRY_KIND
	0, // XS_GLOBAL_KIND
	0, // XS_HOST_KIND
	1, // XS_MAP_KIND
	0, // XS_MODULE_KIND
	0, // XS_PROGRAM_KIND
	0, // XS_PROMISE_KIND
	1, // XS_PROXY_KIND
	1, // XS_REGEXP_KIND
	1, // XS_SET_KIND
	1, // XS_TYPED_ARRAY_KIND
	0, // XS_WEAK_MAP_KIND
	0, // XS_WEAK_REF_KIND
	0, // XS_WEAK_SET_KIND

	0, // XS_ACCESSOR_KIND
	0, // XS_AT_KIND
	0, // XS_ENTRY_KIND
	1, // XS_ERROR_KIND
	0, // XS_HOME_KIND
	0, // XS_KEY_KIND
	0, // XS_KEY_X_KIND
	0, // XS_LIST_KIND
	0, // XS_PRIVATE_KIND
	0, // XS_STACK_KIND
	0, // XS_VAR_KIND
	1, // XS_CALLBACK_X_KIND
#ifdef mxHostFunctionPrimitive
	0, // XS_HOST_FUNCTION_KIND
#endif
	0, // XS_HOST_INSPECTOR_KIND
	0, // XS_INSTANCE_INSPECTOR_KIND
	0, // XS_EXPORT_KIND
	0, // XS_WEAK_ENTRY_KIND
	0, // XS_BUFFER_INFO_KIND
	0, // XS_STATIC_MODULE_RECORD_KIND
};

txBoolean fx_deepEqualInstances(txMachine* the, txSlot* limit, txBoolean strict)
{
	txSlot* leftInstance = (the->stack + 1)->value.reference;
	const txBehavior* leftBehavior = mxBehavior(leftInstance);
	txSlot* leftAt;
	txSlot* leftProperty;
	txSlot* leftBase;
	txSlot** leftAddress;
	txIndex leftCount;
	txSize leftSize;
	txSlot* rightInstance = the->stack->value.reference;
	const txBehavior* rightBehavior = mxBehavior(rightInstance);
	txSlot* rightAt;
	txSlot* rightProperty;
	txSlot* rightBase;
	txSlot** rightAddress;
	txIndex rightCount;
	txSize rightSize;
	txSlot* slot = the->stack + 2;
	while (slot < limit) {
		if (slot->kind == XS_REFERENCE_KIND) {
			if (slot->value.reference == leftInstance)
				return 0;
			if (slot->value.reference == rightInstance)
				return 0;
		}
		slot++;
	}
	if (leftInstance->ID) {
		txSlot* alias = the->aliasArray[leftInstance->ID];
		if (alias)
			leftInstance = alias;
	}
	if (rightInstance->ID) {
		txSlot* alias = the->aliasArray[rightInstance->ID];
		if (alias)
			rightInstance = alias;
	}	
	leftProperty = leftInstance->next;
	rightProperty = rightInstance->next;
	leftBase = (leftProperty && (leftProperty->flag & XS_INTERNAL_FLAG) && gxSpecialKinds[leftProperty->kind]) ? leftProperty : C_NULL;
	rightBase = (rightProperty && (rightProperty->flag & XS_INTERNAL_FLAG) && gxSpecialKinds[rightProperty->kind]) ? rightProperty : C_NULL;
	if (leftBase && (leftBase->kind == XS_ARRAY_KIND) && (leftBase->ID == XS_ORDINARY_BEHAVIOR))
		leftBase = C_NULL;
	if (rightBase && (rightBase->kind == XS_ARRAY_KIND) && (rightBase->ID == XS_ORDINARY_BEHAVIOR))
		rightBase = C_NULL;
	if (leftBase) {
		if (rightBase) {
			switch (leftBase->kind) {
			case XS_BIGINT_KIND:
			case XS_BIGINT_X_KIND:
				if ((rightBase->kind != XS_BIGINT_KIND) && (rightBase->kind != XS_BIGINT_X_KIND))
					return 0;
				if (!gxTypeBigInt.compare(the, 0, 1, 0, leftBase, rightBase))
					return 0;
				break;
			case XS_BOOLEAN_KIND:
				if (rightBase->kind != XS_BOOLEAN_KIND)
					return 0;
				if (leftBase->value.boolean != rightBase->value.boolean)
					return 0;
				break;
			case XS_CALLBACK_KIND:
			case XS_CALLBACK_X_KIND:
				if ((rightBase->kind != XS_CALLBACK_KIND) && (rightBase->kind != XS_CALLBACK_X_KIND))
					return 0;
				if (leftBase->value.callback.address != rightBase->value.callback.address)
					return 0;
				break;
			case XS_CODE_KIND:
			case XS_CODE_X_KIND:
				if ((rightBase->kind != XS_CODE_KIND) && (rightBase->kind != XS_CODE_X_KIND))
					return 0;
				leftSize = ((txChunk*)(((txByte*)(leftBase->value.code.address)) - sizeof(txChunk)))->size;
				rightSize = ((txChunk*)(((txByte*)(leftBase->value.code.address)) - sizeof(txChunk)))->size;
				if (leftSize != rightSize)
					return 0;
				if (c_memcmp(leftBase->value.code.address, rightBase->value.code.address, leftSize))
					return 0;
					
				//?? closures
				break;
			case XS_DATE_KIND:
				if (rightBase->kind != XS_DATE_KIND)
					return 0;
				if (leftBase->value.number != rightBase->value.number)
					return 0;
				break;
			case XS_ERROR_KIND:
				if (rightBase->kind != XS_ERROR_KIND)
					return 0;
				if (!fx_deepEqualProperties(the, limit, 1, mxID(_name)))
					return 0;
				if (!fx_deepEqualProperties(the, limit, 1, mxID(_message)))
					return 0;
				break;
			case XS_NUMBER_KIND:
				if (rightBase->kind != XS_NUMBER_KIND)
					return 0;
				if (!((c_isnan(leftBase->value.number) && c_isnan(rightBase->value.number)) || ((leftBase->value.number == rightBase->value.number) && (c_signbit(leftBase->value.number) == c_signbit(rightBase->value.number)))))
					return 0;
				break;
			case XS_REGEXP_KIND:
				if (rightBase->kind != XS_REGEXP_KIND)
					return 0;
				if (!fx_deepEqualProperties(the, limit, 1, mxID(_lastIndex)))
					return 0;
				if (!fx_deepEqualProperties(the, limit, 1, mxID(_flags)))
					return 0;
				if (!fx_deepEqualProperties(the, limit, 1, mxID(_source)))
					return 0;
				break;
			case XS_STRING_KIND:
			case XS_STRING_X_KIND:
				if ((rightBase->kind != XS_STRING_KIND) && (rightBase->kind != XS_STRING_X_KIND))
					return 0;
				if (c_strcmp(rightBase->value.string, rightBase->value.string))
					return 0;
				leftBehavior = gxBehaviors[0];
				rightBehavior = gxBehaviors[0];
				break;
			case XS_SYMBOL_KIND:
				if (rightBase->kind != XS_SYMBOL_KIND)
					return 0;
				if (leftBase->value.symbol != rightBase->value.symbol)
					return 0;
				break;
				
			case XS_ARRAY_KIND:
				if (rightBase->kind == XS_PROXY_KIND) {
					if (leftBase->ID != XS_ARRAY_BEHAVIOR)
						return 0;
				}
				else {
					if (rightBase->kind != XS_ARRAY_KIND)
						return 0;
					if (leftBase->ID != rightBase->ID)
						return 0;
				}
				break;
				
			case XS_PROXY_KIND:
				if (rightBase->kind == XS_ARRAY_KIND) {
					if (rightBase->ID != XS_ARRAY_BEHAVIOR)
						return 0;
				}
				else {
					if (rightBase->kind != XS_PROXY_KIND)
						return 0;
				}
				break;
				
			case XS_ARRAY_BUFFER_KIND:
				if (rightBase->kind != XS_ARRAY_BUFFER_KIND)
					return 0;
				leftProperty = leftBase->next;
				rightProperty = rightBase->next;
				if (leftProperty->value.bufferInfo.length != rightProperty->value.bufferInfo.length)
					return 0;
				if (leftBase->value.arrayBuffer.address != C_NULL) {
					if (rightBase->value.arrayBuffer.address != C_NULL) {
						if (c_memcmp(leftBase->value.arrayBuffer.address, rightBase->value.arrayBuffer.address, leftProperty->value.bufferInfo.length))
							return 0;
					}
					else
						return 0;
				}
				else if (rightBase->value.arrayBuffer.address != C_NULL)
					return 0;
				break;
			case XS_TYPED_ARRAY_KIND:
				if (rightBase->kind != XS_TYPED_ARRAY_KIND)
					return 0;
				if (leftBase->value.typedArray.dispatch->constructorID != rightBase->value.typedArray.dispatch->constructorID)
					return 0;
				leftBehavior = gxBehaviors[0];
				rightBehavior = gxBehaviors[0];
				leftBase = leftBase->next;
				rightBase = rightBase->next;
				// continue
			case XS_DATA_VIEW_KIND:
				if (rightBase->kind != XS_DATA_VIEW_KIND)
					return 0;
				leftProperty = leftBase->next;
				rightProperty = rightBase->next;
				txSize leftSize = fxGetDataViewSize(the, leftBase, leftProperty);
				txSize rightSize = fxGetDataViewSize(the, rightBase, rightProperty);
				if (leftSize != rightSize)
					return 0;
				if (leftSize > 0) {
					leftProperty = leftProperty->value.reference->next;
					rightProperty = rightProperty->value.reference->next;
					if (c_memcmp(leftProperty->value.arrayBuffer.address + leftBase->value.dataView.offset, rightProperty->value.arrayBuffer.address + rightBase->value.dataView.offset, leftSize))
						return 0;
				}
				break;
			case XS_MAP_KIND:
				if (rightBase->kind != XS_MAP_KIND)
					return 0;
				if (!fx_deepEqualEntries(the, limit, strict, 1))
					return 0;
				break;
			case XS_SET_KIND:
				if (rightBase->kind != XS_SET_KIND)
					return 0;
				if (!fx_deepEqualEntries(the, limit, strict, 0))
					return 0;
				break;
				
		
			default:
				return 0;
			}
		}
		else {
			if (leftBase->kind != XS_PROXY_KIND)
				return 0;
		}
	}
	else if (rightBase) {
		if (rightBase->kind != XS_PROXY_KIND)
			return 0;
	}
	if (!fx_deepEqualProperties(the, limit, 1, mxID(_Symbol_toStringTag)))
		return 0;

	if (strict) {
		mxPushNull();
		txBoolean leftResult = mxBehaviorGetPrototype(the, leftInstance, the->stack);
		mxPushNull();
		txBoolean rightResult = mxBehaviorGetPrototype(the, rightInstance, the->stack);
		if (leftResult) {
			if (rightResult) {
				txSlot* left = the->stack + 1;
				txSlot* right = the->stack;
				if (left->value.reference != right->value.reference)
					return 0;
				mxPop();
				mxPop();
			}
			else
				return 0;
		}
		else if (rightResult)
			return 0;
	}

	txFlag flag = XS_EACH_NAME_FLAG;
	if (strict)
		flag |= XS_EACH_SYMBOL_FLAG;
		
	leftBase = fxNewInstance(the);
	(*leftBehavior->ownKeys)(the, leftInstance, flag, leftBase);
	leftAddress = &(leftBase->next);
	leftCount = 0;
    mxPushUndefined();
    leftProperty = the->stack;
	while ((leftAt = *leftAddress)) {
		if ((*leftBehavior->getOwnProperty)(the, leftInstance, leftAt->value.at.id, leftAt->value.at.index, leftProperty) && !(leftProperty->flag & XS_DONT_ENUM_FLAG)) {
			leftCount++;
			leftAddress = &(leftAt->next);
		}
		else
			*leftAddress = leftAt->next;
	}
	mxPop(); // leftProperty
	
	rightBase = fxNewInstance(the);
	(*rightBehavior->ownKeys)(the, rightInstance, flag, rightBase);
	rightAddress = &(rightBase->next);
	rightCount = 0;
	mxPushUndefined();
	rightProperty = the->stack;
	while ((rightAt = *rightAddress)) {
		if ((*rightBehavior->getOwnProperty)(the, rightInstance, rightAt->value.at.id, rightAt->value.at.index, rightProperty) && !(rightProperty->flag & XS_DONT_ENUM_FLAG)) {
			rightCount++;
			rightAddress = &(rightAt->next);
		}
		else
			*rightAddress = rightAt->next;
	}
	mxPop(); // rightProperty

	if (leftCount != rightCount)
		return 0;
	
	leftAt = leftBase->next;
	while (leftAt) {
		rightAt = rightBase->next;
		while (rightAt) {
			if ((leftAt->value.at.id == rightAt->value.at.id) && (leftAt->value.at.index == rightAt->value.at.index))
				break;
			rightAt = rightAt->next;
		}
		if (!rightAt)
			return 0;
		mxPushReference(leftInstance);
		mxGetAll(leftAt->value.at.id, leftAt->value.at.index);
		mxPushReference(rightInstance);
		mxGetAll(rightAt->value.at.id, rightAt->value.at.index);
		if (!fx_deepEqualSlots(the, limit, strict))
			return 0;
        mxPop();
        mxPop();
		leftAt = leftAt->next;
	}
	mxPop(); // rightAt
	mxPop(); // leftAt

	return 1;
}

txBoolean fx_deepEqualProperties(txMachine* the, txSlot* limit, txBoolean strict, txID id)
{
	txSlot* left = the->stack + 1;
	txSlot* right = the->stack;
	txBoolean result;
	mxPushSlot(left);
	mxGetID(id);
	mxPushSlot(right);
	mxGetID(id);
	result = fx_deepEqualSlots(the, limit, strict);
	mxPop();
	mxPop();
	return result;
}

txBoolean fx_deepEqualSlots(txMachine* the, txSlot* limit, txBoolean strict)
{
	txSlot* left = the->stack + 1;
	txSlot* right = the->stack;
	txBoolean result = 0;
again:
	if (left->kind == right->kind) {
		if ((XS_UNDEFINED_KIND == left->kind) || (XS_NULL_KIND == left->kind))
			result = 1;
		else if (XS_BOOLEAN_KIND == left->kind)
			result = left->value.boolean == right->value.boolean;
		else if (XS_INTEGER_KIND == left->kind)
			result = left->value.integer == right->value.integer;
		else if (XS_NUMBER_KIND == left->kind) {
			if (strict)
				result = ((c_isnan(left->value.number) && c_isnan(right->value.number)) || ((left->value.number == right->value.number) && (c_signbit(left->value.number) == c_signbit(right->value.number))));
			else
				result = ((c_isnan(left->value.number) && c_isnan(right->value.number)) || (left->value.number == right->value.number));
			mxFloatingPointOp("fx_deepEqual");
		}
		else if ((XS_STRING_KIND == left->kind) || (XS_STRING_X_KIND == left->kind))
			result = c_strcmp(left->value.string, right->value.string) == 0;
		else if (XS_SYMBOL_KIND == left->kind)
			result = left->value.symbol == right->value.symbol;
		else if (XS_REFERENCE_KIND == left->kind) {
			if (fxIsSameReference(the, left, right))
				result = 1;
			else
				result = fx_deepEqualInstances(the, limit, strict);
		}
	#ifdef mxHostFunctionPrimitive
		else if (XS_HOST_FUNCTION_KIND == left->kind)
			result = left->value.hostFunction.builder == right->value.hostFunction.builder;
	#endif
		else if ((XS_BIGINT_KIND == left->kind) || (XS_BIGINT_X_KIND == left->kind))
			result = gxTypeBigInt.compare(the, 0, 1, 0, left, right);
		else
			result = 0;
	}
	else if ((XS_INTEGER_KIND == left->kind) && (XS_NUMBER_KIND == right->kind)) {
		if (strict) {
			txNumber aNumber = left->value.integer;
			result = (aNumber == right->value.number) && (signbit(aNumber) == signbit(right->value.number));
		}
		else
			result = (!c_isnan(right->value.number)) && ((txNumber)(left->value.integer) == right->value.number);
		mxFloatingPointOp("fx_deepEqual");
	}
	else if ((XS_NUMBER_KIND == left->kind) && (XS_INTEGER_KIND == right->kind)) {
		if (strict) {
			txNumber bNumber = right->value.integer;
			result = (left->value.number == bNumber) && (signbit(left->value.number) == signbit(bNumber));
		}
		else
			result = (!c_isnan(left->value.number)) && (left->value.number == (txNumber)(right->value.integer));
		mxFloatingPointOp("fx_deepEqual");
	}
	else if ((XS_STRING_KIND == left->kind) && (XS_STRING_X_KIND == right->kind))
		result = c_strcmp(left->value.string, right->value.string) == 0;
	else if ((XS_STRING_X_KIND == left->kind) && (XS_STRING_KIND == right->kind))
		result = c_strcmp(left->value.string, right->value.string) == 0;
	else if (!strict) {
		if ((left->kind == XS_UNDEFINED_KIND) && (right->kind == XS_NULL_KIND))
			result = 1;
		else if ((left->kind == XS_NULL_KIND) && (right->kind == XS_UNDEFINED_KIND))
			result = 1;
		else if (((XS_INTEGER_KIND == left->kind) || (XS_NUMBER_KIND == left->kind)) && ((right->kind == XS_STRING_KIND) || (right->kind == XS_STRING_X_KIND))) {
			fxToNumber(the, right); 
			goto again;
		}
		else if (((left->kind == XS_STRING_KIND) || (left->kind == XS_STRING_X_KIND)) && ((XS_INTEGER_KIND == right->kind) || (XS_NUMBER_KIND == right->kind))) {
			fxToNumber(the, left);
			goto again;
		}
		else if (XS_BOOLEAN_KIND == left->kind) {
			fxToNumber(the, left);
			goto again;
		}
		else if (XS_BOOLEAN_KIND == right->kind) {
			fxToNumber(the, right);
			goto again;
		}
		else if (((XS_BIGINT_KIND == left->kind) || (XS_BIGINT_X_KIND == left->kind)) && ((right->kind == XS_INTEGER_KIND) || (right->kind == XS_NUMBER_KIND) || (right->kind == XS_STRING_KIND) || (right->kind == XS_STRING_X_KIND))) {
			result = gxTypeBigInt.compare(the, 0, 1, 0, left, right);
		}
		else if (((left->kind == XS_INTEGER_KIND) || (left->kind == XS_NUMBER_KIND) || (left->kind == XS_STRING_KIND) || (left->kind == XS_STRING_X_KIND)) && ((XS_BIGINT_KIND == right->kind) || (XS_BIGINT_X_KIND == right->kind))) {
			result = gxTypeBigInt.compare(the, 0, 1, 0, right, left);
		}
		else
			result = 0;
	}
	else 
		result = 0;
	return result;
}

