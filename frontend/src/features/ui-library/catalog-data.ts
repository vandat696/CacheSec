// Sample data from the design export. These are not research results.
export const catalogItems = [
  {
    name: "Button",
    group: "controls",
    description: "Hành động",
    variants: "primary · secondary · tertiary · danger",
    options: {
      label: "Lưu thay đổi",
      variant: "primary",
    },
  },
  {
    name: "TextInput",
    group: "controls",
    description: "Ô nhập một dòng",
    variants: "default · required · error",
    options: {
      label: "Tên hiển thị",
      placeholder: "Nhập tên",
      help: "Nhãn luôn hiển thị.",
    },
  },
  {
    name: "Textarea",
    group: "controls",
    description: "Ô nhập nhiều dòng",
    variants: "default · disabled",
    options: {
      label: "Nội dung",
      placeholder: "Nhập nội dung…",
    },
  },
  {
    name: "Select",
    group: "controls",
    description: "Danh sách lựa chọn",
    variants: "single select",
    options: {
      label: "Ngôn ngữ",
      value: "vi",
      options: [
        {
          value: "vi",
          label: "Tiếng Việt",
        },
        {
          value: "en",
          label: "English",
        },
      ],
    },
  },
  {
    name: "NumberInput",
    group: "controls",
    description: "Giá trị số có giới hạn",
    variants: "min · max · step · error",
    options: {
      label: "Giới hạn token",
      value: 2048,
      min: 256,
      max: 8192,
      step: 256,
      help: "256–8.192, bước 256.",
      error: "Nhập bội số của 256 trong khoảng 256–8.192.",
    },
  },
  {
    name: "Slider",
    group: "controls",
    description: "Thanh trượt và ô số đồng bộ",
    variants: "range · number · validation",
    options: {
      label: "Temperature",
      value: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
      help: "Dải giá trị minh họa, đối chiếu API trước khi dùng.",
    },
  },
  {
    name: "Checkbox",
    group: "controls",
    description: "Lựa chọn độc lập",
    variants: "checked · unchecked · disabled",
    options: {
      label: "Ghi nhớ lựa chọn",
      checked: true,
    },
  },
  {
    name: "Switch",
    group: "controls",
    description: "Bật hoặc tắt một tùy chọn",
    variants: "on · off · disabled",
    options: {
      label: "Cho phép thông báo",
      checked: true,
    },
  },
  {
    name: "Tabs",
    group: "navigation",
    description: "Chuyển nội dung trong cùng ngữ cảnh",
    variants: "selected · keyboard",
    options: {
      label: "Nhóm nội dung",
      items: [
        {
          id: "general",
          label: "Tổng quan",
          content: "Nội dung tổng quan của template.",
        },
        {
          id: "details",
          label: "Chi tiết",
          content: "Nội dung chi tiết. Dùng phím mũi tên để chuyển tab.",
        },
      ],
    },
  },
  {
    name: "Dropdown",
    group: "navigation",
    description: "Menu thao tác",
    variants: "open · closed · keyboard",
    options: {
      label: "Tùy chọn",
      items: [
        {
          value: "duplicate",
          label: "Tạo bản sao",
        },
        {
          value: "details",
          label: "Xem chi tiết",
        },
      ],
    },
  },
  {
    name: "Badge",
    group: "feedback",
    description: "Nhãn trạng thái ngắn",
    variants: "primary · success · danger · neutral",
    options: {
      label: "Đã lưu",
      tone: "success",
    },
  },
  {
    name: "Alert",
    group: "feedback",
    description: "Thông báo trong ngữ cảnh",
    variants: "status · alert",
    options: {
      title: "Thông tin mẫu",
      description:
        "Nội dung do app truyền vào. Không chứa logic nghiệp vụ cố định.",
    },
  },
  {
    name: "Dialog",
    group: "feedback",
    description: "Hộp thoại cần xác nhận",
    variants: "open · close · confirm",
    options: {
      title: "Lưu thay đổi?",
      description: "Ví dụ hộp thoại với hành động xác nhận và đường quay lại.",
      confirmLabel: "Lưu",
    },
  },
  {
    name: "Toast",
    group: "feedback",
    description: "Phản hồi ngắn sau thao tác",
    variants: "show · dismiss · timeout",
    options: {
      message: "Đã lưu thay đổi mẫu.",
      duration: 4000,
    },
  },
  {
    name: "StatCard",
    group: "data",
    description: "Một chỉ số và chú thích",
    variants: "value · unit · description",
    options: {
      label: "Tổng số bản ghi",
      value: "840",
      description: "Dữ liệu minh họa",
    },
  },
  {
    name: "ProgressBar",
    group: "data",
    description: "Giá trị hiện tại so với giới hạn",
    variants: "value · max · unit",
    options: {
      label: "Mức sử dụng",
      value: 42000,
      max: 60000,
      unit: "token",
    },
  },
  {
    name: "DataTable",
    group: "data",
    description: "Bảng dữ liệu có nhãn cột",
    variants: "data · empty",
    options: {
      caption: "Dữ liệu minh họa",
      columns: [
        {
          key: "name",
          label: "Tên",
        },
        {
          key: "value",
          label: "Giá trị",
        },
        {
          key: "status",
          label: "Trạng thái",
        },
      ],
      rows: [
        {
          name: "Mục A",
          value: 120,
          status: "Hoàn tất",
        },
        {
          name: "Mục B",
          value: 80,
          status: "Đang xử lý",
        },
      ],
    },
  },
  {
    name: "LineChart",
    group: "charts",
    description: "Xu hướng theo thứ tự dữ liệu",
    variants: "data · empty",
    options: {
      title: "LineChart · Dữ liệu mẫu",
      unit: "lượt",
      data: [
        {
          label: "T2",
          value: 96,
        },
        {
          label: "T3",
          value: 104,
        },
        {
          label: "T4",
          value: 88,
        },
        {
          label: "T5",
          value: 132,
        },
        {
          label: "T6",
          value: 120,
        },
        {
          label: "T7",
          value: 140,
        },
        {
          label: "CN",
          value: 160,
        },
      ],
    },
  },
  {
    name: "BarChart",
    group: "charts",
    description: "So sánh giá trị giữa các nhóm",
    variants: "data · empty",
    options: {
      title: "BarChart · Dữ liệu mẫu",
      unit: "token",
      data: [
        {
          label: "A",
          value: 4800,
        },
        {
          label: "B",
          value: 5200,
        },
        {
          label: "C",
          value: 4400,
        },
        {
          label: "D",
          value: 6600,
        },
      ],
    },
  },
  {
    name: "DonutChart",
    group: "charts",
    description: "Tỷ trọng của các nhóm trong tổng",
    variants: "data · empty · straight separators",
    options: {
      title: "DonutChart · Dữ liệu mẫu",
      unit: "Bản ghi",
      data: [
        {
          label: "Hoàn tất",
          value: 630,
        },
        {
          label: "Đang mở",
          value: 168,
        },
        {
          label: "Cần hỗ trợ",
          value: 42,
        },
      ],
    },
  },
  {
    name: "FlowDiagram",
    group: "diagrams",
    description: "Các bước xử lý và thông tin từng bước",
    variants: "selected · empty",
    options: {
      nodes: [
        {
          id: "input",
          label: "Đầu vào",
          helper: "Tiếp nhận dữ liệu",
          description: "Nhận dữ liệu do ứng dụng cung cấp.",
        },
        {
          id: "process",
          label: "Xử lý",
          helper: "Áp dụng logic",
          description: "Thực hiện bước xử lý của app. Template không gọi API.",
        },
        {
          id: "output",
          label: "Đầu ra",
          helper: "Trả kết quả",
          description: "Hiển thị kết quả sau xử lý.",
        },
      ],
    },
  },
] as const;

export type CatalogItem = (typeof catalogItems)[number];
export type TemplateName = CatalogItem["name"];
