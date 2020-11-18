#version 300 es
precision mediump float;

#define RENDER_DIST 10.0
#define INTERSECT_DIST 0.001

uniform vec2 u_resolution;
uniform vec3 u_camerapos;

uniform float u_shadowsharp;
uniform float u_smoothing;
uniform float u_shininess;
uniform int u_showsteps;
uniform int u_shownormal;
uniform int u_showshadow;
uniform int u_showspec;
uniform int u_sun;
uniform int u_sky;
uniform int u_antialias;

uniform vec3 u_spherepos;
uniform float u_sphererad;

uniform vec3 u_boxpos;
uniform vec3 u_boxdims; // vec3(width, height, depth)

uniform vec3 u_toruspos;
uniform vec2 u_torusdims; // vec2(height, radius)

uniform vec3 u_cylinderpos;
uniform vec2 u_cylinderdims; // vec2(height, radius)

out vec4 outcolor;

vec3 suncolor = vec3(1.0, 0.95, 0.9);
vec3 skycolor = vec3(0.8, 0.9, 1.0);

struct Mtrl
{
    vec3 color;
    float shininess;
};

struct SurfaceInfo
{
    Mtrl m;
    float t; // distance from point defined in context
};

SurfaceInfo SURFACE_NONE = SurfaceInfo(Mtrl(vec3(0.0), 0.0), -1.0);

/*
 * Signed distance functions
 * https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
 */

float distanceBox(in vec3 p, in vec3 b)
{
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float distanceSphere(in vec3 p, in float r)
{
    return length(p) - r;
}

float distanceTorus(in vec3 p, in vec2 t)
{
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float distanceCylinder(in vec3 p, in vec2 c)
{
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(c.x, c.y);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/*
 * Operators
 * https://iquilezles.org/www/articles/smin/smin.htm
 */

SurfaceInfo booleanUnion(in SurfaceInfo a, in SurfaceInfo b)
{
    if (a.t < b.t) return a; else return b;
}

SurfaceInfo booleanIntersect(in SurfaceInfo a, in SurfaceInfo b)
{
    if (a.t > b.t) return a; else return b;
}

// Subtract b from a
SurfaceInfo booleanSubtract(in SurfaceInfo a, in SurfaceInfo b)
{
    return booleanIntersect(a, SurfaceInfo(b.m, -b.t));
}

SurfaceInfo smoothUnion(in SurfaceInfo a, in SurfaceInfo b, in float k)
{
    float h = clamp(0.5 + 0.5 * (b.t - a.t) / k, 0.0, 1.0);
    vec3 c = mix(b.m.color, a.m.color, h);
    Mtrl m = Mtrl(c, mix(b.m.shininess, a.m.shininess, h));
    float d = mix(b.t, a.t, h) - k * h * (1.0 - h);
    return SurfaceInfo(m, d);
}

SurfaceInfo smoothIntersect(in SurfaceInfo a, in SurfaceInfo b, in float k)
{
    SurfaceInfo v = smoothUnion(SurfaceInfo(a.m, -a.t), SurfaceInfo(b.m, -b.t), k);
    return SurfaceInfo(v.m, -v.t);
}

// Subtract b from a
SurfaceInfo smoothSubtract(in SurfaceInfo a, in SurfaceInfo b, in float k)
{
    return smoothIntersect(a, SurfaceInfo(b.m, -b.t), k);
}



SurfaceInfo distanceToScene(in vec3 origin)
{
    // Floor checkerboard pattern
    bool evenZ = origin.z - 0.5 * floor(origin.z / 0.5) > 0.25;
    bool evenX = origin.x - 0.5 * floor(origin.x / 0.5) > 0.25;
    float floorcolor = ((evenZ ? evenX : !evenX) ? 0.7 : 0.9);

    // Colours of objects
    Mtrl mtrl_floor = Mtrl(vec3(floorcolor), 0.0);
    Mtrl mtrl_sphere = Mtrl(vec3(0.8, 0.2, 0.2), u_shininess);
    Mtrl mtrl_torus = Mtrl(vec3(0.2, 0.2, 0.8), u_shininess);
    Mtrl mtrl_box = Mtrl(vec3(0.9, 0.8, 0.0), u_shininess);
    Mtrl mtrl_cylinder = Mtrl(vec3(0.9, 0.8, 0.2), u_shininess);

    // Distance to objects
    SurfaceInfo sphere = SurfaceInfo(mtrl_sphere, distanceSphere(u_spherepos - origin, u_sphererad));
    SurfaceInfo torus = SurfaceInfo(mtrl_torus, distanceTorus(u_toruspos - origin, u_torusdims));
    SurfaceInfo box = SurfaceInfo(mtrl_box, distanceBox(u_boxpos - origin, u_boxdims) - 0.003);
    SurfaceInfo cylinder = SurfaceInfo(mtrl_cylinder, distanceCylinder(u_cylinderpos - origin, u_cylinderdims));

    // Blend nearest surfaces
    SurfaceInfo res = smoothUnion(sphere, torus, u_smoothing);
    res = booleanUnion(res, smoothSubtract(box, cylinder, u_smoothing));
    res = booleanUnion(res, SurfaceInfo(mtrl_floor, origin.y));

    return res;
}

// Returns the distance marched by the ray
SurfaceInfo rayMarch(in vec3 ray_origin, in vec3 rd)
{
    float t = 0.0;
    int steps = 0;
    while (t < RENDER_DIST)
    {
        vec3 ro = ray_origin + t * rd;
        SurfaceInfo s = distanceToScene(ro);
        if (s.t < INTERSECT_DIST)
        {
            if (u_showsteps == 1)
            {
                float shade = clamp(float(steps) / 100.0, 0.0, 1.0);
                s.m.color = vec3(shade);
            }
            return SurfaceInfo(s.m, t);
        }
        t += s.t;
        steps++;
    }
    return SURFACE_NONE;
}

// Returns normalised vector normal to surface at position pos
vec3 normalToSurface(in vec3 pos)
{
    vec2 e = vec2(0.0001, 0);
    float t = distanceToScene(pos).t;
    vec3 normal = t - vec3(
        distanceToScene(pos - e.xyy).t,
        distanceToScene(pos - e.yxy).t,
        distanceToScene(pos - e.yyx).t
    );
    return normalize(normal);
}

// Calculate soft shadow due to point light
float pointShadow(in vec3 pos, in vec3 normal, in vec3 light, in float k)
{
    // Soft shadows
    float t = 0.0;
    vec3 ro = pos + normal * INTERSECT_DIST;
    vec3 rd = normalize(light - pos);
    float shadow = 1.0;
    while (t < RENDER_DIST)
    {
        float dist = distanceToScene(ro).t;
        if (dist < INTERSECT_DIST)
        {
            shadow = 0.1;
            break;
        }
        t += dist;
        shadow = min(shadow, k * dist / t);
        ro += rd * dist;
    }

    return shadow;
}

vec3 pointLight(in vec3 rd, in vec3 pos, in vec3 normal, in vec3 light, in Mtrl m)
{
    vec3 ld = normalize(light - pos); // light direction
    float diff = clamp(dot(normal, ld), 0.0, 1.0); // diffusive light
    vec3 r = reflect(ld, normal); // reflected light
    float spec = u_showspec == 1 ? pow(clamp(dot(rd, r), 0.0, 1.0), 5.0 / m.shininess) * diff : 0.0; // specular reflection
    float shadow = u_showshadow == 1 ? pointShadow(pos, normal, light, u_shadowsharp) : 1.0;
    return (diff * vec3(suncolor) * m.color + 0.5 * spec * vec3(suncolor)) * shadow;
}

vec3 dirLight(in vec3 rd, in vec3 pos, in vec3 normal, in vec3 ld, in Mtrl m)
{
    float diff = clamp(dot(normal, ld), 0.0, 1.0);
    vec3 r = reflect(ld, normal); // reflected light
    float spec = u_showspec == 1 ? pow(clamp(dot(rd, r), 0.0, 1.0), 5.0 / m.shininess) * diff : 0.0;
    return diff * 0.3 * vec3(skycolor) * m.color + 0.2 * spec * vec3(skycolor);
}

void main()
{
    // Camera calculations
    vec3 ro = u_camerapos; // Ray origin
    vec3 lookat = vec3(0.0, 0.1, 1.0); // The point we are looking at
    float screendistance = 1.0; // Distance from the camera to the screen's centre
    vec3 z = normalize(lookat - ro); // New basis vectors
    vec3 x = cross(vec3(0.0, 1.0, 0.0), z);
    vec3 y = cross(z, x);

    // Light positions and color definitions
    vec3 light = vec3(3.0, 3.0, 1.5); // Sun position
    vec3 dirlight = normalize(vec3(0.0, 1.0, 0.0)); // Sky lighting direction
    vec3 fogcolor = vec3(0.8, 0.8, 0.8); // Distance fog color

    // Average pixel color over AA*AA pixels for antialiasing
    vec3 tot = vec3(0.0);
    int AA = u_antialias == 1 ? 2 : 1;
    for (int m = 0; m < AA; m++)
    {
        for (int n = 0; n < AA; n++)
        {
            vec2 offset = vec2(float(m), float(n)) / float(AA) - 0.5;
        	vec2 uv = ((gl_FragCoord.xy + offset) - 0.5 * u_resolution.xy) / u_resolution.y;

            // The new basis vectors for the camera
            vec3 z = normalize(lookat - ro);
            vec3 x = cross(vec3(0.0, 1.0, 0.0), z);
            vec3 y = cross(z, x);

            vec3 centre = ro + z * screendistance; // The centre of the screen
            vec3 screenintersect = centre + uv.x * x + uv.y * y; // Where the ray goes through the screen

            vec3 rd = normalize(screenintersect - ro); // Ray direction

            // Get the point of intersection, if there is one
            SurfaceInfo s = rayMarch(ro, rd);
            if (u_showsteps == 1)
            {
                tot += s.m.color;
                continue;
            }
            if (s == SURFACE_NONE) // no intersection
            {
                tot += fogcolor;
                continue;
            }
            vec3 surfacepoint = ro + rd * s.t;
            vec3 normal = normalToSurface(surfacepoint);

            if (u_shownormal == 1)
            {
                tot += normal / 2.0 + 0.5;
                continue;
            }

            // Sum all lighting
            vec3 col = vec3(0.0);
            col += 0.1 * s.m.color; // Ambient
            if (u_sun == 1) col += pointLight(rd, surfacepoint, normal, light, s.m); // Sun
            if (u_sky == 1) col += dirLight(rd, surfacepoint, normal, dirlight, s.m); // Sky
            col = mix(col, fogcolor, 1.0 - exp(-0.01 * pow(s.t, 3.0))); // Distance fog

            tot += col;
        }
    }

    outcolor = vec4(tot / float(AA * AA), 1.0);
}

