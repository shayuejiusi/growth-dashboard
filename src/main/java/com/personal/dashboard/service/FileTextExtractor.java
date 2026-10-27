package com.personal.dashboard.service;

import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 上传文件文本提取：.txt / .md / .csv / .docx / .xlsx
 * 纯 JDK 实现（docx/xlsx 本质是 ZIP+XML），无需额外依赖。
 */
@Service
public class FileTextExtractor {

    public String extract(String filename, byte[] data) {
        String lower = filename == null ? "" : filename.toLowerCase();
        try {
            if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) return fromTxt(data);
            if (lower.endsWith(".docx")) return fromDocx(data);
            if (lower.endsWith(".xlsx")) return fromXlsx(data);
            if (lower.endsWith(".xls")) {
                throw new IllegalArgumentException("暂不支持旧版 .xls 格式，请另存为 .xlsx 后上传");
            }
            throw new IllegalArgumentException("仅支持 .txt / .md / .csv / .docx / .xlsx 文件");
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("文件解析失败：" + e.getMessage());
        }
    }

    /** 纯文本类（txt/md/csv）：UTF-8 优先，失败回退 GBK */
    private String fromTxt(byte[] data) {
        try {
            StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(data));
            return new String(data, StandardCharsets.UTF_8);
        } catch (CharacterCodingException e) {
            return new String(data, Charset.forName("GBK"));
        }
    }

    /** docx：读取 word/document.xml，按段落拼接 w:t 文本 */
    private String fromDocx(byte[] data) throws Exception {
        byte[] xml = unzipEntry(data, "word/document.xml");
        Document doc = parseXml(xml);
        NodeList paragraphs = doc.getElementsByTagName("w:p");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < paragraphs.getLength(); i++) {
            NodeList texts = ((Element) paragraphs.item(i)).getElementsByTagName("w:t");
            StringBuilder line = new StringBuilder();
            for (int j = 0; j < texts.getLength(); j++) {
                line.append(texts.item(j).getTextContent());
            }
            if (!line.isEmpty()) sb.append(line).append('\n');
        }
        return sb.toString().trim();
    }

    /** xlsx：共享字符串表 + 第一个工作表，按行拼接单元格文本 */
    private String fromXlsx(byte[] data) throws Exception {
        List<String> shared = new ArrayList<>();
        byte[] sharedXml = unzipEntryOrNull(data, "xl/sharedStrings.xml");
        if (sharedXml != null) {
            NodeList siList = parseXml(sharedXml).getElementsByTagName("si");
            for (int i = 0; i < siList.getLength(); i++) {
                NodeList texts = ((Element) siList.item(i)).getElementsByTagName("t");
                StringBuilder s = new StringBuilder();
                for (int j = 0; j < texts.getLength(); j++) s.append(texts.item(j).getTextContent());
                shared.add(s.toString());
            }
        }
        byte[] sheetXml = unzipEntryOrNull(data, "xl/worksheets/sheet1.xml");
        if (sheetXml == null) throw new IllegalArgumentException("未找到工作表数据");
        NodeList rows = parseXml(sheetXml).getElementsByTagName("row");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < rows.getLength(); i++) {
            NodeList cells = ((Element) rows.item(i)).getElementsByTagName("c");
            StringBuilder line = new StringBuilder();
            for (int j = 0; j < cells.getLength(); j++) {
                Element cell = (Element) cells.item(j);
                NodeList v = cell.getElementsByTagName("v");
                if (v.getLength() == 0) continue;
                String value = v.item(0).getTextContent();
                if ("s".equals(cell.getAttribute("t"))) {
                    int idx = Integer.parseInt(value);
                    value = idx < shared.size() ? shared.get(idx) : "";
                }
                if (!value.isBlank()) {
                    if (!line.isEmpty()) line.append(" ");
                    line.append(value.trim());
                }
            }
            if (!line.isEmpty()) sb.append(line).append('\n');
        }
        return sb.toString().trim();
    }

    private Document parseXml(byte[] xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        // 关闭外部实体，防 XXE
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
    }

    private byte[] unzipEntry(byte[] zipData, String name) throws Exception {
        byte[] result = unzipEntryOrNull(zipData, name);
        if (result == null) throw new IllegalArgumentException("文件内容缺失：" + name);
        return result;
    }

    private byte[] unzipEntryOrNull(byte[] zipData, String name) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(zipData))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (name.equals(entry.getName())) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    zip.transferTo(out);
                    return out.toByteArray();
                }
            }
        }
        return null;
    }
}
