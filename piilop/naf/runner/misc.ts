import {
    uniqueNamesGenerator,
    adjectives,
    colors,
    animals,
} from "unique-names-generator";

export const randomName = (): string => {
    return uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
    });
};
