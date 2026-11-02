import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
export default function AdminBookingsChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <div>
      {!total && (
        <p className="mb-3 text-sm text-muted">
          Chưa có đặt chỗ trong 30 ngày gần đây.
        </p>
      )}
      <div
        className="h-64 min-w-0 text-primary"
        role="img"
        aria-label={`Biểu đồ đặt chỗ 30 ngày, tổng ${total} đơn.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={data}
            margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="#E7E5E4" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                String(value).slice(5).split('-').reverse().join('/')
              }
              tick={{ fontSize: 11, fill: '#57534E' }}
              tickLine={false}
              axisLine={false}
              minTickGap={35}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#57534E' }}
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip
              labelFormatter={(value) =>
                String(value).split('-').reverse().join('/')
              }
              formatter={(value) => [value, 'Đặt chỗ']}
              contentStyle={{
                border: '1px solid #E7E5E4',
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Line
              type="linear"
              dataKey="count"
              name="Đặt chỗ"
              stroke="currentColor"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
