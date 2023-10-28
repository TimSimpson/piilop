// this is mainly used to test if test data matches with the "createArgs" argument
export const objectIsSubsetOf = (subset: any, superset: any): boolean => {
    for (const [key, value] of Object.entries(subset)) {
        if (superset[key] !== value) {
            return false;
        }
    }
    return true;
};
