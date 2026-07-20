local max_width_cm
local max_height_cm
local size_cache = {}
local warned = {}

local function warn_once(source, message)
  if warned[source] then
    return
  end
  warned[source] = true
  local text = "无法限制图片尺寸 " .. source .. "：" .. message
  if pandoc.log and pandoc.log.warn then
    pandoc.log.warn(text)
  else
    io.stderr:write("[WARNING] " .. text .. "\n")
  end
end

local function metadata_number(meta, key)
  local value = meta[key]
  if value == nil then
    return nil
  end
  return tonumber(pandoc.utils.stringify(value))
end

local function read_config(meta)
  max_width_cm = metadata_number(meta, "md2docx-image-max-width-cm")
  max_height_cm = metadata_number(meta, "md2docx-image-max-height-cm")
end

local function image_size(source)
  local cached = size_cache[source]
  if cached ~= nil then
    return cached or nil
  end
  if pandoc.image == nil or pandoc.image.size == nil then
    warn_once(source, "当前 Pandoc 不支持 pandoc.image.size，请升级到 3.1.13 或更高版本")
    size_cache[source] = false
    return nil
  end

  local fetched, _, contents = pcall(pandoc.mediabag.fetch, source)
  if not fetched or contents == nil then
    warn_once(source, fetched and "未读取到图片内容" or tostring(_))
    size_cache[source] = false
    return nil
  end

  local measured, size = pcall(pandoc.image.size, contents, PANDOC_WRITER_OPTIONS)
  if not measured then
    warn_once(source, tostring(size))
    size_cache[source] = false
    return nil
  end

  size_cache[source] = size
  return size
end

local function limit_image(image)
  if max_width_cm == nil or max_height_cm == nil then
    return nil
  end
  if image.attributes.width ~= nil or image.attributes.height ~= nil then
    return nil
  end

  local size = image_size(image.src)
  if size == nil then
    return nil
  end

  local fallback_dpi = PANDOC_WRITER_OPTIONS.dpi or 96
  local horizontal_dpi = size.dpi_horz > 0 and size.dpi_horz or fallback_dpi
  local vertical_dpi = size.dpi_vert > 0 and size.dpi_vert or fallback_dpi
  local width_cm = size.width / horizontal_dpi * 2.54
  local height_cm = size.height / vertical_dpi * 2.54
  local scale = math.min(1, max_width_cm / width_cm, max_height_cm / height_cm)

  if scale >= 1 then
    return nil
  end

  image.attributes.width = string.format("%.4fcm", width_cm * scale)
  image.attributes.height = string.format("%.4fcm", height_cm * scale)
  return image
end

return {
  { Meta = read_config },
  { Image = limit_image },
}
