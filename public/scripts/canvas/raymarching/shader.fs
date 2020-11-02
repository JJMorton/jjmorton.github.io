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

vec3 spherecolor = vec3(0.8, 0.2, 0.2);
vec3 boxcolor = vec3(0.9, 0.8, 0.0);
vec3 toruscolor = vec3(0.2, 0.2, 0.8);
vec3 cylindercolor = vec3(0.9, 0.9, 0.2);

vec3 suncolor = vec3(1.0, 0.95, 0.9);
vec3 skycolor = vec3(0.8, 0.9, 1.0);

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

vec4 booleanUnion(in vec4 a, in vec4 b)
{
    return a.w < b.w ? a : b;
}

vec4 booleanIntersect(in vec4 a, in vec4 b)
{
    return a.w > b.w ? a : b;
}

// Subtract b from a
vec4 booleanSubtract(in vec4 a, in vec4 b)
{
    return booleanIntersect(a, vec4(b.rgb, -b.w));
}

vec4 smoothUnion(in vec4 a, in vec4 b, in float k)
{
    float h = clamp(0.5 + 0.5 * (b.w - a.w) / k, 0.0, 1.0);
    vec3 c = mix(b.rgb, a.rgb, h);
    float d = mix(b.w, a.w, h) - k * h * (1.0 - h);
    return vec4(c, d);
}

vec4 smoothIntersect(in vec4 a, in vec4 b, in float k)
{
    vec4 v = smoothUnion(vec4(a.rgb, -a.w), vec4(b.rgb, -b.w), k);
    return vec4(v.rgb, -v.w);
}

// Subtract b from a
vec4 smoothSubtract(in vec4 a, in vec4 b, in float k)
{
    return smoothIntersect(a, vec4(b.rgb, -b.w), k);
}



// Distance to nearest point of objects
// returns vec4(red, green, blue, distance)
vec4 distanceToScene(in vec3 origin)
{
    bool evenZ = origin.z - 0.5 * floor(origin.z / 0.5) > 0.25;
    bool evenX = origin.x - 0.5 * floor(origin.x / 0.5) > 0.25;
    float floorcolor = ((evenZ ? evenX : !evenX) ? 0.7 : 0.9);

    vec4 sphere = vec4(spherecolor.rgb, distanceSphere(u_spherepos - origin, u_sphererad));
    vec4 box = vec4(boxcolor.rgb, distanceBox(u_boxpos - origin, u_boxdims));
    vec4 torus = vec4(toruscolor.rgb, distanceTorus(u_toruspos - origin, u_torusdims));
    vec4 cylinder = vec4(cylindercolor.rgb, distanceCylinder(u_cylinderpos - origin, u_cylinderdims));
    vec4 res = smoothUnion(sphere, torus, u_smoothing);
    res = booleanUnion(res, smoothSubtract(box, cylinder, u_smoothing));
    res = booleanUnion(res, vec4(vec3(floorcolor), origin.y));
    return res;
}

// Returns the distance marched by the ray
vec4 rayMarch(in vec3 ray_origin, in vec3 rd)
{
    float t = 0.0;
    int steps = 0;
    while (t < RENDER_DIST)
    {
        vec3 ro = ray_origin + t * rd;
        vec4 dist = distanceToScene(ro);
        if (dist.w < INTERSECT_DIST)
        {
            return vec4(u_showsteps == 0 ? dist.rgb : (vec3(clamp(float(steps) / 100.0, 0.0, 1.0))), t);
        }
        t += dist.w;
        steps++;
    }
    return vec4(u_showsteps == 0 ? vec3(0.0, 0.0, 0.0) : (vec3(clamp(float(steps) / 100.0, 0.0, 1.0))), -1.0);
}

// Returns normalised vector normal to surface at position pos
vec3 normalToSurface(in vec3 pos)
{
    vec2 e = vec2(0.0001, 0);
    float pos_dist = distanceToScene(pos).w;
    vec3 normal = pos_dist - vec3(
        distanceToScene(pos - e.xyy).w,
        distanceToScene(pos - e.yxy).w,
        distanceToScene(pos - e.yyx).w
    );
    return normalize(normal);
}

float pointShadow(in vec3 pos, in vec3 normal, in vec3 light, in float k)
{
    // Soft shadows
    float t = 0.0;
    vec3 ro = pos + normal * INTERSECT_DIST;
    vec3 rd = normalize(light - pos);
    float shadow = 1.0;
    while (t < RENDER_DIST)
    {
        float dist = distanceToScene(ro).w;
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

vec3 pointLight(in vec3 rd, in vec3 pos, in vec3 normal, in vec3 light, in vec3 mat_color)
{
    vec3 ld = normalize(light - pos); // light direction
    float diff = clamp(dot(normal, ld), 0.0, 1.0); // diffusive light
    vec3 r = reflect(ld, normal); // reflected light
    float spec = u_showspec == 1 ? 0.5 * pow(clamp(dot(rd, r), 0.0, 1.0), 5.0 / u_shininess) * diff : 0.0; // specular reflection
    float shadow = u_showshadow == 1 ? pointShadow(pos, normal, light, u_shadowsharp) : 1.0;
    return (diff * vec3(suncolor) * mat_color + spec * vec3(suncolor)) * shadow;
}

vec3 dirLight(in vec3 pos, in vec3 normal, in vec3 ld, in vec3 mat_color)
{
    float diff = clamp(dot(normal, ld), 0.0, 1.0);
    return diff * 0.3 * vec3(skycolor) * mat_color;
}

void main()
{
    vec3 ro = u_camerapos; // Ray origin
    vec3 light = vec3(3.0, 3.0, 1.5); // Sun source
    vec3 dirlight = normalize(vec3(0.0, 1.0, 0.0)); // Sky lighting direction

    vec3 tot = vec3(0.0);
    int AA = u_antialias == 1 ? 2 : 1;
    for (int m = 0; m < AA; m++)
    {
        for (int n = 0; n < AA; n++)
        {

            vec2 offset = vec2(float(m),float(n)) / float(AA) - 0.5;
        	vec2 uv = ((gl_FragCoord.xy + offset) - 0.5 * u_resolution.xy) / u_resolution.y;

            vec3 lookat = vec3(0.0, 0.1, 1.0); // The point we are looking at

            float screendistance = 1.0; // Distance from the camera to the screen's centre

            // The new basis vectors for the camera
            vec3 z = normalize(lookat - ro);
            vec3 x = cross(vec3(0.0, 1.0, 0.0), z);
            vec3 y = cross(z, x);

            vec3 centre = ro + z * screendistance; // The centre of the screen
            vec3 screenintersect = centre + uv.x * x + uv.y * y; // Where the ray goes through the screen

            vec3 rd = normalize(screenintersect - ro); // Ray direction

            // Get the point of intersection, if there is one
            vec4 intersect_dist = rayMarch(ro, rd);
            if (u_showsteps == 1)
            {
                tot += intersect_dist.rgb;
                continue;
            }
            if (intersect_dist.w == -1.0) // no intersection
            {
                tot += vec3(0.8, 0.8, 0.8);
                continue;
            }
            vec3 intersect_pos = ro + rd * intersect_dist.w;
            vec3 normal = normalToSurface(intersect_pos);

            if (u_shownormal == 1)
            {
                tot += normal.rgb / 2.0 + 0.5;
                continue;
            }

            // Calculate lighting
            vec3 col = vec3(0.0);
            col += 0.1 * intersect_dist.rgb; // Ambient
            if (u_sun == 1) col += pointLight(rd, intersect_pos, normal, light, intersect_dist.rgb); // Sun
            if (u_sky == 1) col += dirLight(intersect_pos, normal, dirlight, intersect_dist.rgb); // Sky
            col = mix(col, vec3(0.8, 0.8, 0.8), 1.0 - exp(-0.01 * pow(intersect_dist.w, 3.0)));
            tot += col;
        }
    }

    tot /= float(AA * AA);

    outcolor = vec4(tot, 1.0);
}
