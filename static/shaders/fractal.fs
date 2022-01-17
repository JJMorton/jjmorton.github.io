#version 300 es
precision highp float;

#define PI 3.14159

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_zoom;
uniform int u_iterations;
uniform vec3 u_colorfg;
uniform vec3 u_colorbg;
uniform vec3 u_coloraccent;
uniform vec2 u_position;
uniform vec3 u_coeffs;
uniform int u_type;

out vec4 outcolor;

vec2 cpow(vec2 z, int exponent)
{
    for (int i = 1; i < exponent; i++) {
        z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y);
    }
    return z;
}

float mandelbrot(vec2 p, vec2 centre, float zoom)
{
    vec2 z = vec2(0.0, 0.0);
    vec2 c = (p * 2.0 - 1.0) / zoom + vec2(centre.x, -centre.y);
    int i;
    float escape_radius = 2.0;
    for (i = 0; i < u_iterations && dot(z, z) < escape_radius * escape_radius; i++)
    {
        z = cpow(z, 2) + c;
    }
    
    float r = float(i) / float(u_iterations);
    
    return r;
}

float generic(vec2 p, vec2 centre, float zoom)
{
    vec2 z = (p * 2.0 - 1.0) / zoom + vec2(centre.x, -centre.y);
    vec2 c = vec2(u_coeffs.x + u_coeffs.z * cos(u_time), u_coeffs.y + u_coeffs.z * sin(u_time));
    int i;
    float escape_radius = 2.0;
    for (i = 0; i < u_iterations && dot(z, z) < escape_radius * escape_radius; i++)
    {
        z = cpow(z, 2) + c;
    }
    
    float r = float(i) / float(u_iterations);
    
    return r;
}


void main()
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = gl_FragCoord.xy/u_resolution.xy;
    
    float r = 0.0;
    switch (u_type)
    {
        case 0: r = mandelbrot(uv.xy, u_position, u_zoom); break;
        case 1: r = generic(uv.xy, u_position, u_zoom); break;
    }

    if (r > 0.1)
    {
        outcolor = vec4(mix(u_coloraccent, u_colorfg, (r - 0.1) / 0.9), 1.0);
    }
    else
    {
        outcolor = vec4(mix(u_colorbg, u_coloraccent, r/0.1), 1.0);
    }
}