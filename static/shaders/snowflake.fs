#version 300 es
precision mediump float;

in vec4 color;

layout (location = 0) out vec4 out_color;

void main()
{
	out_color = color;
}
