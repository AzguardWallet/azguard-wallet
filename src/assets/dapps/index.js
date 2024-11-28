export const daapsMetadata = [
    {
        name: "3route",
        icon: "3route,png",
        description: "",
    },
    {
        name: "juster",
        icon: "juster,png",
        description: "",
    },
    {
        name: "atomex",
        icon: "atomex,png",
        description: "",
    },
]

export function getDaapsMetadataByName (name) {
    return daapsMetadata.find(d => d.name === name)
}
