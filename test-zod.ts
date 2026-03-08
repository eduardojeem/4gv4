import { updateCustomerSchema, validateCustomerData, getValidationErrors } from './src/lib/validations/customer';

const data1 = { name: 'A' };
const val1 = validateCustomerData(updateCustomerSchema, data1);
if (!val1.success) {
    console.log('val1 errors:', getValidationErrors(val1.errors));
}

const data2 = {};
const val2 = validateCustomerData(updateCustomerSchema, data2);
if (!val2.success) {
    console.log('val2 errors:', getValidationErrors(val2.errors));
}