#version 300 es
precision mediump float;

#define RENDER_DIST 10.0
#define INTERSECT_DIST 0.001

uniform vec2 u_resolution;
uniform vec3 u_camerapos;

uniform float u_shadowsharp;
uniform float u_reflect;
uniform int u_reflectcount;
uniform float u_smoothing;
uniform int u_floorreflect;
uniform int u_showsteps;
uniform int u_shownormal;
uniform int u_showshadow;
uniform int u_showdiffuse;

uniform vec3 u_spherepos;
uniform float u_sphererad;

uniform vec3 u_boxpos;
uniform vec3 u_boxdims; // vec3(width, height, depth)

uniform vec3 u_toruspos;
uniform vec2 u_torusdims; // vec2(height, radius)

uniform vec3 u_cylinderpos;
uniform vec2 u_cylinderdims; // vec2(height, radius)

out vec4 color;

vec3 spherecolor = vec3(0.8, 0.2, 0.2);
vec3 boxcolor = vec3(0.9, 0.8, 0.0);
vec3 toruscolor = vec3(0.2, 0.2, 0.8);
vec3 cylindercolor = vec3(0.9, 0.9, 0.2);

/*
 * Signed distance functions
 * https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
 */

float distanceBox(vec3 p, vec3 b)
{
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float distanceSphere(vec3 p, float r)
{
    return length(p) - r;
}

float distanceTorus(vec3 p, vec2 t)
{
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float distanceCylinder(vec3 p, vec2 c)
{
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(c.x, c.y);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/*
 * Operators
 * https://iquilezles.org/www/articles/smin/smin.htm
 */

vec4 booleanUnion(vec4 a, vec4 b)
{
    return a.w < b.w ? a : b;
}

vec4 booleanIntersect(vec4 a, vec4 b)
{
    return a.w > b.w ? a : b;
}

// Subtract b from a
vec4 booleanSubtract(vec4 a, vec4 b)
{
    return booleanIntersect(a, vec4(b.rgb, -b.w));
}

vec4 smoothUnion(vec4 a, vec4 b, float k)
{
    float h = clamp(0.5 + 0.5 * (b.w - a.w) / k, 0.0, 1.0);
    vec3 c = mix(b.rgb, a.rgb, h);
    float d = mix(b.w, a.w, h) - k * h * (1.0 - h);
    return vec4(c, d);
}

vec4 smoothIntersect(vec4 a, vec4 b, float k)
{
    vec4 v = smoothUnion(vec4(a.rgb, -a.w), vec4(b.rgb, -b.w), k);
    return vec4(v.rgb, -v.w);
}

// Subtract b from a
vec4 smoothSubtract(vec4 a, vec4 b, float k)
{
    return smoothIntersect(a, vec4(b.rgb, -b.w), k);
}



// Distance to nearest point of objects
// returns vec4(red, green, blue, distance)
vec4 distanceToScene(vec3 origin)
{
    bool evenZ = origin.z - 0.5 * floor(origin.z / 0.5) > 0.25;
    bool evenX = origin.x - 0.5 * floor(origin.x / 0.5) > 0.25;
    float floorbrightness = ((evenZ ? evenX : !evenX) ? 0.8 : 1.0);

    vec4 sphere = vec4(spherecolor.rgb, distanceSphere(u_spherepos - origin, u_sphererad));
    vec4 box = vec4(boxcolor.rgb, distanceBox(u_boxpos - origin, u_boxdims));
    vec4 torus = vec4(toruscolor.rgb, distanceTorus(u_toruspos - origin, u_torusdims));
    vec4 cylinder = vec4(cylindercolor.rgb, distanceCylinder(u_cylinderpos - origin, u_cylinderdims));
    vec4 res = smoothUnion(sphere, torus, u_smoothing);
    res = booleanUnion(res, smoothSubtract(box, cylinder, u_smoothing));
    res = booleanUnion(res, vec4(vec3(floorbrightness), origin.y));
    return res;
}

// Returns the distance marched by the ray
vec4 rayMarch(vec3 ray_origin, vec3 rd)
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
    return vec4(0.0, 0.0, 0.0, -1.0);
}

// Returns normalised vector normal to surface at position pos
vec3 normalToSurface(vec3 pos)
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

float brightnessAt(vec3 pos, vec3 normal, vec3 light)
{
    vec3 direction = normalize(light - pos);
    return clamp(dot(normal, direction), 0.0, 1.0);
}

float shadowAt(vec3 pos, vec3 normal, vec3 light, float k)
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

void main()
{
	color = vec4(0.0, 0.0, 0.0, 1.0);

    vec3 ro = u_camerapos; // Ray origin
    vec3 light = vec3(3.0, 5.0, 1.5);
	vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    vec3 lookat = vec3(0.0, 0.1, 1.0); // The point we are looking at

    float screendistance = 1.0; // Distance from the camera to the screen's centre

    // The new basis vectors for the camera
    vec3 z = normalize(lookat - ro);
    vec3 x = cross(vec3(0.0, 1.0, 0.0), z);
    vec3 y = cross(z, x);

    vec3 centre = ro + z * screendistance; // The centre of the screen
    vec3 screenintersect = centre + uv.x * x + uv.y * y; // Where the ray goes through the screen

    vec3 rd = normalize(screenintersect - ro); // Ray direction

    // Diffuse lighting and reflections
    color = vec4(0.0, 0.0, 0.0, 1.0);
    for (int i = 0; i < u_reflectcount + 1; i++)
    {
        // Get the point of intersection, if there is one
        vec4 intersect_dist = rayMarch(ro, rd);
        if (intersect_dist.w == -1.0) break;
        vec3 intersect_pos = ro + rd * intersect_dist.w;

        // Calculate lighting
        vec3 normal = normalToSurface(intersect_pos);
        float brightness = u_showdiffuse == 0 ? 1.0 : brightnessAt(intersect_pos, normal, light);
        float shadow = u_showshadow == 0 ? 1.0 : shadowAt(intersect_pos, normal, light, u_shadowsharp);
        brightness *= shadow * pow(u_reflect, float(i));

        // Apply distance fog
        if (i == 0) brightness -= pow(intersect_dist.w / RENDER_DIST, 2.0);

        // Checkerboard pattern on floor
        bool evenZ = intersect_pos.z - 0.5 * floor(intersect_pos.z / 0.5) > 0.25;
        bool evenX = intersect_pos.x - 0.5 * floor(intersect_pos.x / 0.5) > 0.25;
        brightness *= (intersect_pos.y <= INTERSECT_DIST && (evenZ ? evenX : !evenX) ? 0.8 : 1.0);

        // Multiply with color of object intersected with
        color += vec4(u_shownormal == 0 ? intersect_dist.rgb : normal.rgb / 2.0 + 0.5, 0.0) * brightness;

        // New origin for reflection
        if (u_floorreflect == 0 && intersect_pos.y <= INTERSECT_DIST) break; // Don't reflect off the floor
        vec3 reflected = reflect(rd, normal);
        rd = reflected;
        ro = intersect_pos + normal * INTERSECT_DIST * 2.0; // Take the intersection point out of the object
    }
    color = clamp(color, 0.0, 1.0);
}
