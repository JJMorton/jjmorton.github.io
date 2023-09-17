#version 300 es

const float HEX_WIDTH = sqrt(3.0);
const float HEX_HEIGHT = 3.0 / 2.0;

uniform vec2 u_resolution;
uniform int u_gridradius;
uniform vec3 u_accentcolor;
// TODO: Implement the global transforms from JS, so that we don't calculate them every time
uniform mat2 transform;

layout (location = 0) in vec2 a_position;
layout (location = 1) in float a_color;

out vec4 color;


// The sum of n from 1 to N
// Only defined for n >= 0
int sum_n(int N)
{
	if (N <= 0) return 0;
	return int(0.5 * float(N * (N + 1)));
}


// Given a grid of radius `r`, return the row that the cell with the specified index falls in
int cell_row(int radius, int index)
{
	float r_plus_half = float(radius) + 0.5;
	// Take the middle of the cell to avoid floating point precision errors for the first cell of each row
	float i = float(index) + 0.5;
	return int(-r_plus_half + sqrt(r_plus_half*r_plus_half + 2.0 * i));
}


// Given a grid of radius `r`, and a cell in row `row` and index `index`, return the column it falls in
int cell_column(int radius, int row, int index)
{
	int cells_before = sum_n(radius + row) - sum_n(radius);
	int offset = (radius - row + radius % 2) / 2;
	return index - cells_before + offset;
}


void main()
{
	int num_cells = 1 + sum_n(u_gridradius) * 6;

	/*
	 * If the cell is in the bottom half (i.e. below the middle row), then
	 * calculate the position of the corresponding symmetrical cell in the
	 * top half, then flip the coordinates at the end.
	 */
	float flip_coords = 1.0;
	int cell_index = gl_InstanceID;
	if (cell_index >= sum_n(2*u_gridradius + 1) - sum_n(u_gridradius))
	{
		flip_coords = -1.0;
		cell_index = num_cells - cell_index - 1;
	}

	int row = cell_row(u_gridradius, cell_index);
	int col = cell_column(u_gridradius, row, cell_index);

	float row_offset = (row % 2 == 1 ? 0.5 : 0.0) * HEX_WIDTH;

	int gridsize = 2 * u_gridradius + 1;
	vec2 pos = a_position// * 0.95
	         + vec2(HEX_WIDTH * float(col), -HEX_HEIGHT * float(row))
	         + vec2(row_offset, 0.0)
	         - vec2(0.5 * HEX_WIDTH * float(u_gridradius % 2), 0.0)
	         - float(u_gridradius) * vec2(HEX_WIDTH, -HEX_HEIGHT);

	pos *= flip_coords / (HEX_WIDTH * 0.5 * float(gridsize));

	// Correct for aspect ratio
	float aspect = u_resolution.x / u_resolution.y;
	if (aspect > 1.0)
	{
		pos.x = pos.x / aspect + 0.25 * (aspect - 1.0);
	}
	else
	{
		pos.y = pos.y * aspect + 0.5 * (1.0 - aspect);
	}

	// Calculate the colour of the hexagon
	vec3 white = vec3(1.0, 1.0, 1.0);
	if (a_color >= 1.0)
	{
		color = vec4((2.0 - a_color) * white, 1.0);
	}
	else {
		color = vec4(u_accentcolor + (white - u_accentcolor) * a_color, 1.0);
	}

	gl_Position = vec4(pos.xy, 0.0, 1.0);
}
