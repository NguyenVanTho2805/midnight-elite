// SCL P1-5 — loginVaiFor: trang đăng nhập/đăng ký mở sẵn tab Học sinh khi đang định vào khu học sinh hoặc cầm link mời. Thuần, không cần máy chủ.
import { check, section, done } from "./h";
import { loginVaiFor, isInviteEntry } from "@/lib/safeRedirect";

section("vai ghi rõ thì theo vai");
check("vai=hoc-sinh", loginVaiFor("hoc-sinh", null) === "hoc-sinh");
check("vai=gia-su thắng cả redirect học sinh", loginVaiFor("gia-su", "/student/nhap-ma-lop?code=ABCD2345") === "gia-su");

section("redirect khu học sinh / link mời ⇒ Học sinh");
check("CA PHÁ: link mời /student/nhap-ma-lop?code=… ⇒ hoc-sinh", loginVaiFor(null, "/student/nhap-ma-lop?code=ABCD2345") === "hoc-sinh");
check("/student ⇒ hoc-sinh", loginVaiFor(null, "/student") === "hoc-sinh");
check("/student/viec-cua-toi ⇒ hoc-sinh", loginVaiFor(undefined, "/student/viec-cua-toi") === "hoc-sinh");
check("đường khác có ?code= ⇒ hoc-sinh", loginVaiFor(null, "/khoa-hoc/x?a=1&code=ABCD2345") === "hoc-sinh");

section("còn lại ⇒ Gia sư (mặc định cũ)");
check("không redirect", loginVaiFor(null, null) === "gia-su");
check("/lop-cua-toi", loginVaiFor(null, "/lop-cua-toi") === "gia-su");
check("/studentx không phải khu học sinh", loginVaiFor(null, "/studentx") === "gia-su");
check("?mycode= không phải code=", loginVaiFor(null, "/x?mycode=1") === "gia-su");
check("redirect ngoài (//host/student) bị bỏ ⇒ gia-su", loginVaiFor(null, "//evil.example/student") === "gia-su");
check("vai lạ bị bỏ qua, theo redirect", loginVaiFor("admin", "/student") === "hoc-sinh");

section("isInviteEntry");
check("đúng ô nhập mã (có/không ?code)", isInviteEntry("/student/nhap-ma-lop") && isInviteEntry("/student/nhap-ma-lop?code=X"));
check("không phải", !isInviteEntry(null) && !isInviteEntry("/student/nhap-ma-lop-x") && !isInviteEntry("/student"));

done();
