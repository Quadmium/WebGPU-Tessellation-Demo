// Grab a local file
async function fetchLocal(url) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest
        xhr.onload = function() {
        resolve(xhr.responseText);
        }
        xhr.onerror = function() {
        reject(new TypeError('Local request failed'))
        }
        xhr.open('GET', url)
        xhr.send(null)
    })
}

async function loadOBJ(url, flipWinding=false) {
    const rawText = await fetchLocal(url);
    const rawLines = rawText.split("\n");

    // Sequential array of vertex data [v0x v0y v0z v1x v1y v1z ...]
    const vertices = [];

    // UV buffer
    const uvs = [];

    // Normal buffer
    const normals = [];

    // Index buffers
    const indices = [];
    const uvIndices = [];
    const normalIndices = [];

    for (let line of rawLines) {
        if (line.length == 0) {
            continue;
        }

        const segments = line.split(" ");

        if (segments[0] == 'v') {
            // v x y z
            for (let i = 1; i < 4; i++) {
                vertices.push(parseFloat(segments[i]));
            }
        }
        else if (segments[0] == 'vt') {
            // vt u v
            for (let i = 1; i < 3; i++) {
                uvs.push(parseFloat(segments[i]));
            }
        }
        else if (segments[0] == 'vn') {
            // vn x y z
            for (let i = 1; i < 4; i++) {
                normals.push(parseFloat(segments[i]));
            }
        }
        else if (segments[0] == 'f') {
            // f v1 v2 v3 v4 ...
            // parse as triangle fan
            const segments = line.split(" ");
            for (let i = 2; i < segments.length - 1; i++) {
                const t1 = segments[1];
                const t2 = segments[i];
                const t3 = segments[i+1];
                for (let x of flipWinding ? [t1, t3, t2] : [t1, t2, t3]) {
                    const [v, vt, vn] = x.split("/");
                    indices.push(parseInt(v) - 1);
                    uvIndices.push(parseInt(vt) - 1);
                    normalIndices.push(parseInt(vn) - 1);
                }
            }
        }
    }

    const packed = [];
    for (let i = 0; i < indices.length; i++) {
        let vi = indices[i];
        let uvi = uvIndices[i];
        let ni = normalIndices[i];
        packed.push({
            position: vec3.fromValues(vertices[3*vi], vertices[3*vi+1], vertices[3*vi+2]),
            uv: vec2.fromValues(uvs[2*uvi], uvs[2*uvi + 1]),
            normal: vec3.fromValues(normals[3*ni], normals[3*ni+1], normals[3*ni+2])
        });
    }

    return packed;
}

function flatten(packed) {
    const flat = [];
    for (let vertex of packed) {
        flat.push(vertex.position[0]);
        flat.push(vertex.position[1]);
        flat.push(vertex.position[2]);
        flat.push(vertex.uv[0]);
        flat.push(vertex.uv[1]);
        flat.push(vertex.normal[0]);
        flat.push(vertex.normal[1]);
        flat.push(vertex.normal[2]);
    }
    return flat
}

function asLines(packed) {
    const result = [];
    for (let i = 0; i < packed.length / 3; i++) {
        // Triangle is t1 t2 t3
        // Line between t1,t2 t1,t3 t2,t3
        const t1 = packed[3*i];
        const t2 = packed[3*i+1];
        const t3 = packed[3*i+2];
        result.push(t1);
        result.push(t2);
        result.push(t1);
        result.push(t3);
        result.push(t2);
        result.push(t3);
    }
    return result;
}

function tessellate(packed) {
    const result = [];
    for (let i = 0; i < packed.length / 3; i++) {
        // Triangle is t1 t2 t3
        // midpoints are m12, m13, m23
        const t1 = packed[3*i];
        const t2 = packed[3*i+1];
        const t3 = packed[3*i+2];
        const m12 = {
            position: vec3.create(),
            uv: vec2.create(),
            normal: vec3.create()
        };

        const m13 = {
            position: vec3.create(),
            uv: vec2.create(),
            normal: vec3.create()
        };

        const m23 = {
            position: vec3.create(),
            uv: vec2.create(),
            normal: vec3.create()
        };
        
        vec3.add(m12.position, t1.position, t2.position);
        vec3.scale(m12.position, m12.position, 0.5);
        vec3.add(m13.position, t1.position, t3.position);
        vec3.scale(m13.position, m13.position, 0.5);
        vec3.add(m23.position, t2.position, t3.position);
        vec3.scale(m23.position, m23.position, 0.5);

        
        vec2.add(m12.uv, t1.uv, t2.uv);
        vec2.scale(m12.uv, m12.uv, 0.5);
        vec2.add(m13.uv, t1.uv, t3.uv);
        vec2.scale(m13.uv, m13.uv, 0.5);
        vec2.add(m23.uv, t2.uv, t3.uv);
        vec2.scale(m23.uv, m23.uv, 0.5);


        
        vec3.add(m12.normal, t1.normal, t2.normal);
        vec3.scale(m12.normal, m12.normal, 0.5);
        vec3.add(m13.normal, t1.normal, t3.normal);
        vec3.scale(m13.normal, m13.normal, 0.5);
        vec3.add(m23.normal, t2.normal, t3.normal);
        vec3.scale(m23.normal, m23.normal, 0.5);

        
        
        
        // m12 m23 m13
        // t1 m12 m13
        // m12 t2 m23
        // m23 t3 m13
        result.push(m12);
        result.push(m23);
        result.push(m13);
        
        result.push(t1);
        result.push(m12);
        result.push(m13);

        result.push(m12);
        result.push(t2);
        result.push(m23);

        result.push(m23);
        result.push(t3);
        result.push(m13);
    }
    return result;
}