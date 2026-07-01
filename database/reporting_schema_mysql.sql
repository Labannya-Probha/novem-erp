CREATE TABLE IF NOT EXISTS report_categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_templates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT NOT NULL,
  report_code VARCHAR(60) UNIQUE NOT NULL,
  report_name VARCHAR(220) NOT NULL,
  report_category VARCHAR(80) NOT NULL,
  ifrs_reference VARCHAR(40),
  data_source TEXT NOT NULL,
  grouping_option JSON NOT NULL,
  sorting_option JSON NOT NULL,
  export_permission BOOLEAN NOT NULL DEFAULT TRUE,
  print_permission BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_templates_category FOREIGN KEY (category_id) REFERENCES report_categories(id)
);

CREATE TABLE IF NOT EXISTS report_fields (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_template_id BIGINT NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  field_label VARCHAR(160) NOT NULL,
  data_type VARCHAR(40) NOT NULL,
  alignment VARCHAR(20) NOT NULL DEFAULT 'left',
  column_width INT NOT NULL DEFAULT 120,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_total BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_report_fields (report_template_id, field_key),
  CONSTRAINT fk_report_fields_template FOREIGN KEY (report_template_id) REFERENCES report_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_filters (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_template_id BIGINT NOT NULL,
  filter_key VARCHAR(80) NOT NULL,
  filter_label VARCHAR(160) NOT NULL,
  filter_type VARCHAR(40) NOT NULL,
  default_value TEXT,
  options JSON NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_report_filters (report_template_id, filter_key),
  CONSTRAINT fk_report_filters_template FOREIGN KEY (report_template_id) REFERENCES report_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_kpis (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_template_id BIGINT NOT NULL,
  kpi_key VARCHAR(80) NOT NULL,
  kpi_label VARCHAR(160) NOT NULL,
  calculation_expression TEXT,
  value_type VARCHAR(40) NOT NULL DEFAULT 'number',
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_report_kpis (report_template_id, kpi_key),
  CONSTRAINT fk_report_kpis_template FOREIGN KEY (report_template_id) REFERENCES report_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_user_access (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_template_id BIGINT NOT NULL,
  user_id CHAR(36),
  role VARCHAR(60),
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_export BOOLEAN NOT NULL DEFAULT FALSE,
  can_print BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report_user_access (report_template_id, user_id, role),
  CONSTRAINT fk_report_access_template FOREIGN KEY (report_template_id) REFERENCES report_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_export_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_template_id BIGINT,
  report_code VARCHAR(60) NOT NULL,
  export_format VARCHAR(20) NOT NULL,
  filters JSON NOT NULL,
  generated_by CHAR(36),
  generated_by_name VARCHAR(160),
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64),
  user_agent TEXT,
  INDEX idx_report_export_logs_report_date (report_code, generated_at),
  CONSTRAINT fk_report_export_template FOREIGN KEY (report_template_id) REFERENCES report_templates(id)
);

CREATE TABLE IF NOT EXISTS report_print_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_template_id BIGINT,
  report_code VARCHAR(60) NOT NULL,
  page_size VARCHAR(20) NOT NULL DEFAULT 'A4',
  filters JSON NOT NULL,
  printed_by CHAR(36),
  printed_by_name VARCHAR(160),
  printed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64),
  user_agent TEXT,
  INDEX idx_report_print_logs_report_date (report_code, printed_at),
  CONSTRAINT fk_report_print_template FOREIGN KEY (report_template_id) REFERENCES report_templates(id)
);
