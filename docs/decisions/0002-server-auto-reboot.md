# 0002. 서버가 멈추면 스스로 재부팅한다

- 날짜: 2026-10-21
- 상태: 채택

## 맥락
2026-10-20 22:02 UTC에 pahidc(KVM, 4코어·4GB)가 오류 기록 없이 멈췄다. 수동 재부팅(10-21 09:04 UTC)까지 약 11시간 API가 다운됐다(Sentry FRUIT-API-2).

- 직전 자원은 여유가 있었다: 메모리 사용 28%, CPU 97% 유휴, 부하 0.1.
- 로그에 OOM·커널 패닉·디스크·네트워크 오류·정상 종료 기록이 없다. 평소 로그가 이어지다 끊긴다.
- 커널 멈춤인지 하이퍼바이저의 VM 정지인지는 로그로 구분할 수 없다.
- 장애가 길어진 직접 원인은 스스로 복구하는 장치가 없었던 것이다(`kernel.panic = 0`, 워치독 없음).

## 결정
- 커널 패닉·oops·soft lockup이면 10초 뒤 재부팅한다(`deploy/host/99-fruit-auto-reboot.conf`).
- 하드웨어 워치독이 없으므로 softdog를 올리고 systemd 런타임 워치독(60초)을 켠다. systemd가 1분 넘게 응답하지 않으면 재부팅된다.
- Ubuntu는 softdog를 블랙리스트에 올려 두어 `modules-load.d`로는 부팅 때 로드되지 않는다. `fruit-softdog.service`가 `modprobe`로 직접 올리고 systemd 워치독을 다시 연결한다.
- 설정은 `deploy/host/`에 두고 `sudo bash deploy/host/install.sh`로 설치한다. 컨테이너·cloudflared는 이미 부팅 때 자동으로 뜨므로 재부팅되면 서비스도 돌아온다.

## 한계
- 하이퍼바이저가 VM 자체를 멈추면 게스트 안의 설정으로는 복구할 수 없다. 같은 일이 반복되면 호스팅 업체에 해당 시각의 장애를 문의한다.
- `hung_task_panic`은 디스크가 잠깐 느릴 때 불필요한 재부팅을 일으킬 수 있어 켜지 않는다.
