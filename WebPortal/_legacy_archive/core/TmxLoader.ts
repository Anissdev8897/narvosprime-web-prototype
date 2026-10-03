import { XMLParser } from 'fast-xml-parser'; // On utilise un parser XML générique souvent dispo ou natif DOMParser si browser

export interface MapData {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    background: string;
    colliders: { x: number; y: number; width: number; height: number; polygon?: { x: number, y: number }[] }[];
}

export class TmxLoader {

    async load(path: string): Promise<MapData> {
        const response = await fetch(path);
        const text = await response.text();

        // Utilisation du DOMParser natif du navigateur
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const map = xmlDoc.getElementsByTagName("map")[0];
        const width = parseInt(map.getAttribute("width") || "0");
        const height = parseInt(map.getAttribute("height") || "0");
        const tileWidth = parseInt(map.getAttribute("tilewidth") || "0");
        const tileHeight = parseInt(map.getAttribute("tileheight") || "0"); // 1024 dans votre cas ?

        // Trouver l'image de fond (souvent dans un tileset image collection ou image layer)
        // Dans votre cas, c'est probablement un Image Layer ou un Object Layer avec Tile
        // Simplification : on cherche l'image liée au premier tileset ou image layer
        let bgImage = "";
        const imageTags = xmlDoc.getElementsByTagName("image");
        if (imageTags.length > 0) {
            const source = imageTags[0].getAttribute("source");
            if (source) {
                // Nettoyage du chemin (Tiled utilise des chemins relatifs ../..)
                bgImage = source.split('/').pop() || "";
            }
        }

        // Parsing des collisions
        const colliders: any[] = [];
        const objectGroups = xmlDoc.getElementsByTagName("objectgroup");

        for (let i = 0; i < objectGroups.length; i++) {
            const group = objectGroups[i];
            const groupName = group.getAttribute("name")?.toLowerCase();

            if (groupName === "colision" || groupName === "collisions") {
                const objects = group.getElementsByTagName("object");
                for (let j = 0; j < objects.length; j++) {
                    const obj = objects[j];
                    const x = parseFloat(obj.getAttribute("x") || "0");
                    const y = parseFloat(obj.getAttribute("y") || "0");

                    // Gestion Polygon
                    const polygon = obj.getElementsByTagName("polygon")[0];
                    if (polygon) {
                        const pointsStr = polygon.getAttribute("points") || "";
                        const points = pointsStr.split(" ").map(p => {
                            const [px, py] = p.split(",").map(Number);
                            return { x: px, y: py };
                        });
                        colliders.push({ x, y, width: 0, height: 0, polygon: points });
                    } else {
                        // Rectangle simple
                        const w = parseFloat(obj.getAttribute("width") || "0");
                        const h = parseFloat(obj.getAttribute("height") || "0");
                        colliders.push({ x, y, width: w, height: h });
                    }
                }
            }
        }

        console.log(`[TmxLoader] Loaded map ${width}x${height}, Found ${colliders.length} colliders.`);

        return {
            width, height, tileWidth, tileHeight,
            background: bgImage,
            colliders
        };
    }
}
