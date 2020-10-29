#version 300 es
precision mediump float;

#define RENDER_DIST 50.0
#define INTERSECT_DIST 0.001

uniform vec2 u_resolution;
uniform vec3 u_camerapos;

uniform float u_shadowsharp;
uniform float u_reflect;
uniform int u_reflectcount;
uniform float u_smoothing;
uniform int u_floorreflect;

uniform vec3 u_spherepos;
uniform float u_sphererad;

uniform vec3 u_boxpos;
uniform vec3 u_boxdims; // vec3(width, height, depth)

uniform vec3 u_toruspos;
uniform vec2 u_torusdims; // vec2(height, radius)

uniform vec3 u_cylinderpos;
uniform vec2 u_cylinderdims; // vec2(height, radius)

out vec4 color;

// https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
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

// https://iquilezles.org/www/articles/smin/smin.htm
float smin(float a, float b, float k)
{
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k)
{
    return -smin(-a, -b, k);
}

// Distance to nearest point of objects
float distanceToScene(vec3 origin)
{
    float min_dist = RENDER_DIST;
    float sphere = distanceSphere(u_spherepos - origin, u_sphererad);
    float box = distanceBox(u_boxpos - origin, u_boxdims);
    float torus = distanceTorus(u_toruspos - origin, u_torusdims);
    float cylinder = distanceCylinder(u_cylinderpos - origin, u_cylinderdims);
    float res = smin(sphere, torus, u_smoothing);
    // res = smin(res, box, u_smoothing);
    // res = smin(res, cylinder, u_smoothing);
    res = smin(res, smax(box, -cylinder, u_smoothing), u_smoothing);
    res = min(res, origin.y);
    return res;
}

// Returns the distance marched by the ray
float rayMarch(vec3 ray_origin, vec3 rd)
{
    float t = 0.0;
    while (t < RENDER_DIST)
    {
        vec3 ro = ray_origin + t * rd;
        float dist = distanceToScene(ro);
        if (dist < INTERSECT_DIST) return t;
        t += dist;
    }
    return -1.0;
}

// Returns normalised vector normal to surface at position pos
vec3 normalToSurface(vec3 pos)
{
    vec2 e = vec2(0.0001, 0);
    float pos_dist = distanceToScene(pos);
    vec3 normal = pos_dist - vec3(
        distanceToScene(pos - e.xyy),
        distanceToScene(pos - e.yxy),
        distanceToScene(pos - e.yyx)
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
        float dist = distanceToScene(ro);
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
    float totalBrightness = 0.0;
    for (int i = 0; i < u_reflectcount + 1; i++)
    {
        // Get the point of intersection, if there is one
        float intersect_dist = rayMarch(ro, rd);
        if (intersect_dist == -1.0) break;
        vec3 intersect_pos = ro + rd * intersect_dist;

        // Calculate lighting
        vec3 normal = normalToSurface(intersect_pos);
        float brightness = brightnessAt(intersect_pos, normal, light);
        float shadow = shadowAt(intersect_pos, normal, light, u_shadowsharp);

        // Checkerboard pattern on floor
        bool evenZ = intersect_pos.z - 0.5 * floor(intersect_pos.z / 0.5) > 0.25;
        bool evenX = intersect_pos.x - 0.5 * floor(intersect_pos.x / 0.5) > 0.25;
        brightness *= (intersect_pos.y <= INTERSECT_DIST && (evenZ ? evenX : !evenX) ? 0.8 : 1.0);

        totalBrightness += brightness * shadow * pow(u_reflect, float(i));

        // New origin for reflection
        if (u_floorreflect == 0 && intersect_pos.y <= INTERSECT_DIST) break; // Don't reflect off the floor
        vec3 reflected = reflect(rd, normal);
        rd = reflected;
        ro = intersect_pos + normal * INTERSECT_DIST * 2.0; // Take the intersection point out of the object
    }
    totalBrightness = clamp(totalBrightness, 0.0, 1.0);
    color = vec4(totalBrightness, totalBrightness, totalBrightness, 1.0);
}
