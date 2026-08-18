# K8s 学习沙盒 - 验证计划

## 1. 环境配置验证

### 1.1 OrbStack 配置
```bash
# 验证配置文件
cat ~/.orbstack/config/docker.json

# 预期输出：
{
  "http-proxy": "http://host.docker.internal:7890",
  "https-proxy": "http://host.docker.internal:7890",
  "no-proxy": "localhost,127.0.0.1,host.docker.internal,*.orb.local,*.docker.internal",
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}

# 验证代理连通性
curl -x http://127.0.0.1:7890 https://registry-1.docker.io/v2/
# 预期：返回 401（需要认证，说明网络通）

# 验证镜像加速
curl -s https://docker.m.daocloud.io/v2/
# 预期：返回 401 或正常响应
```

### 1.2 Docker 环境
```bash
# 验证 Docker 版本
docker --version
# 预期：Docker version 29.4.0

# 验证 Docker 运行状态
docker info | grep -A 5 "Registry Mirrors"
# 预期：显示配置的镜像加速地址

# 验证镜像构建
docker images | grep demo
# 预期：显示 demo:v1 和 demo:v2
```

## 2. 工具安装验证

### 2.1 kubectx / kubens
```bash
# 验证命令可用
which kubectx kubens
# 预期：/opt/homebrew/bin/kubectx 和 /opt/homebrew/bin/kubens

# 测试功能
kubectx
# 预期：显示 orbstack 和 default

kubens
# 预期：显示可用命名空间列表
```

### 2.2 kubectl
```bash
# 验证版本
kubectl version --client
# 预期：v1.33.9

# 验证集群连接
kubectl cluster-info
# 预期：显示 Kubernetes control plane 和 CoreDNS 地址

# 验证节点状态
kubectl get nodes
# 预期：orbstack 节点 Ready
```

## 3. 核心服务验证

### 3.1 Ingress Controller
```bash
# 验证 Pod 状态
kubectl get pods -n ingress-nginx
# 预期：ingress-nginx-controller Running (1/1)

# 验证 Service
kubectl get svc -n ingress-nginx
# 预期：ingress-nginx-controller LoadBalancer，EXTERNAL-IP 为 192.168.139.2

# 验证 IngressClass
kubectl get ingressclass
# 预期：nginx (ingress-nginx)
```

### 3.2 Dashboard
```bash
# 验证 Pod 状态
kubectl get pods -n kubernetes-dashboard
# 预期：kubernetes-dashboard 和 dashboard-metrics-scraper 都 Running

# 验证 Service
kubectl get svc -n kubernetes-dashboard
# 预期：kubernetes-dashboard ClusterIP 443/TCP

# 验证 ServiceAccount
kubectl get sa -n kubernetes-dashboard admin-user
# 预期：admin-user 存在

# 验证 ClusterRoleBinding
kubectl get clusterrolebinding admin-user
# 预期：admin-user 绑定到 cluster-admin

# 测试 Token 生成
kubectl -n kubernetes-dashboard create token admin-user
# 预期：生成 JWT token（很长的一串）

# 测试 Dashboard 访问
curl -sk https://localhost:8443
# 预期：HTTP 200，返回 HTML 页面
```

### 3.3 Demo 应用
```bash
# 验证 Deployment
kubectl get deploy demo
# 预期：3/3 Ready，UP-TO-DATE 3，AVAILABLE 3

# 验证 Pod
kubectl get pods -l app=demo
# 预期：3 个 Running Pod

# 验证 Service
kubectl get svc demo demo-nodeport
# 预期：
# - demo ClusterIP 8080/TCP
# - demo-nodeport NodePort 8080:30080/TCP

# 验证 Ingress
kubectl get ingress demo
# 预期：demo nginx demo.local 192.168.139.2 80

# 测试访问
curl -H "Host: demo.local" http://localhost/
# 预期：返回 <h1>demo v1</h1>

curl http://localhost:30080/
# 预期：返回 <h1>demo v1</h1>
```

## 4. 功能测试

### 4.1 滚动更新测试
```bash
# 1. 查看当前版本
curl -H "Host: demo.local" http://localhost/
# 预期：显示 v1

# 2. 执行滚动更新
kubectl set image deploy/demo demo=demo:v2
kubectl rollout status deploy/demo
# 预期：更新成功

# 3. 验证新版本
curl -H "Host: demo.local" http://localhost/
# 预期：显示 v2

# 4. 查看 ReplicaSet
kubectl get rs -l app=demo
# 预期：显示两个 RS，一个 replicas=3，一个 replicas=0

# 5. 回滚
kubectl rollout undo deploy/demo
kubectl rollout status deploy/demo

# 6. 验证回滚
curl -H "Host: demo.local" http://localhost/
# 预期：显示 v1
```

### 4.2 ConfigMap 热更新测试
```bash
# 1. 部署 ConfigMap
kubectl apply -f k8s-learn/04-configmap-secret.yaml

# 2. 查看初始配置
kubectl exec config-demo -- cat /etc/demo/app.properties
# 预期：显示 mode=dev, log.level=info

# 3. 修改 ConfigMap
kubectl edit cm demo-config
# 修改 MESSAGE 字段为 "Hello from updated ConfigMap"

# 4. 验证文件挂载更新（自动生效）
kubectl exec config-demo -- cat /etc/demo/app.properties
# 预期：显示更新后的内容

# 5. 验证环境变量更新（需要重启 Pod）
kubectl exec config-demo -- env | grep MESSAGE
# 预期：显示旧值
kubectl delete pod config-demo
kubectl apply -f k8s-learn/04-configmap-secret.yaml
kubectl exec config-demo -- env | grep MESSAGE
# 预期：显示新值
```

### 4.3 Ingress 多路径测试
```bash
# 1. 编辑 Ingress 添加多路径
cat > k8s-learn/05-ingress-multi.yaml << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-multi
spec:
  ingressClassName: nginx
  rules:
  - host: demo.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: demo
            port:
              number: 8080
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: demo
            port:
              number: 8080
EOF

kubectl apply -f k8s-learn/05-ingress-multi.yaml

# 2. 验证路由
curl -H "Host: demo.local" http://localhost/
curl -H "Host: demo.local" http://localhost/api
# 预期：都能访问到 demo 应用

# 3. 清理
kubectl delete ingress demo-multi
```

### 4.4 Job/CronJob 测试
```bash
# 1. 部署 Job
kubectl apply -f k8s-learn/06-job-cronjob.yaml

# 2. 验证 Job
kubectl get jobs
# 预期：hello-job Completed

# 3. 查看 Job 日志
kubectl logs job/hello-job
# 预期：显示 "Hello from Job, current time: ..."

# 4. 验证 CronJob
kubectl get cronjob
# 预期：hello-cron 显示调度时间和上次调度时间

# 5. 等待 1-2 分钟
sleep 120

# 6. 验证 CronJob 执行
kubectl get pods | grep hello-cron
# 预期：显示新创建的 Pod

# 7. 清理
kubectl delete -f k8s-learn/06-job-cronjob.yaml
```

### 4.5 PVC 持久化测试
```bash
# 1. 部署 PVC
kubectl apply -f k8s-learn/07-pvc.yaml

# 2. 验证 PV/PVC
kubectl get pv,pvc
# 预期：demo-pv 和 demo-pvc 都 Bound

# 3. 写入数据
kubectl exec data-demo -- sh -c "echo 'test data' > /mnt/data/test.txt"

# 4. 验证数据
kubectl exec data-demo -- cat /mnt/data/test.txt
# 预期：显示 "test data"

# 5. 删除 Pod
kubectl delete pod data-demo

# 6. 重新部署
kubectl apply -f k8s-learn/07-pvc.yaml

# 7. 验证数据持久化
kubectl exec data-demo -- cat /mnt/data/test.txt
# 预期：仍然显示 "test data"

# 8. 清理
kubectl delete -f k8s-learn/07-pvc.yaml
```

## 5. 学习资源验证

### 5.1 文件完整性
```bash
# 验证所有学习文件存在
ls -lh k8s-learn/*.yaml
# 预期：01-pod.yaml 到 07-pvc.yaml 共 7 个文件

# 验证 README
ls -lh k8s-learn/README.md
# 预期：README.md 存在

# 验证 demo 应用
ls -lh k8s-learn/demo-app/
# 预期：server.js 和 Dockerfile
```

### 5.2 YAML 语法检查
```bash
# 验证所有 YAML 文件语法
for f in k8s-learn/*.yaml; do
  echo "Checking $f..."
  kubectl apply -f "$f" --dry-run=client
done
# 预期：所有文件通过语法检查
```

## 6. 故障排查

### 6.1 常见问题
```bash
# 问题：Pod 一直 Pending
kubectl describe pod <pod-name>
# 查看 Events 部分，寻找原因

# 问题：镜像拉取失败
kubectl describe pod <pod-name>
# 查看是否有 ErrImagePull 或 ImagePullBackOff

# 问题：Service 无法访问
kubectl get endpoints <service-name>
# 检查是否有后端 Pod

# 问题：Ingress 无法访问
kubectl describe ingress <ingress-name>
# 检查 Backend 和 Rules

# 问题：Dashboard 无法登录
kubectl -n kubernetes-dashboard create token admin-user
# 重新生成 token
```

### 6.2 日志查看
```bash
# 查看 Pod 日志
kubectl logs <pod-name>

# 查看上一个容器的日志
kubectl logs <pod-name> --previous

# 实时查看日志
kubectl logs -f <pod-name>

# 查看 Deployment 日志
kubectl logs deploy/<deployment-name>
```

## 7. 清理验证

### 7.1 清理学习资源
```bash
# 删除所有学习资源
kubectl delete -f k8s-learn/01-pod.yaml
kubectl delete -f k8s-learn/02-deployment.yaml
kubectl delete -f k8s-learn/03-service.yaml
kubectl delete -f k8s-learn/04-configmap-secret.yaml
kubectl delete -f k8s-learn/05-ingress.yaml
kubectl delete -f k8s-learn/06-job-cronjob.yaml
kubectl delete -f k8s-learn/07-pvc.yaml

# 验证清理
kubectl get pods,svc,ingress
# 预期：只剩下 kubernetes 和 ingress-nginx 相关资源
```

### 7.2 清理核心组件（可选）
```bash
# 卸载 Dashboard
kubectl delete -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml

# 卸载 Ingress Controller
kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.1/deploy/static/provider/cloud/deploy.yaml

# 验证清理
kubectl get ns
# 预期：kubernetes-dashboard 和 ingress-nginx 命名空间被删除
```

## 8. 验证清单

- [ ] OrbStack 配置正确（代理 + 镜像加速）
- [ ] kubectx / kubens 可用
- [ ] Ingress Controller Running
- [ ] Dashboard Running 且可访问
- [ ] Demo 应用 3 副本 Running
- [ ] Ingress 路由正常
- [ ] NodePort 访问正常
- [ ] 滚动更新成功
- [ ] 回滚成功
- [ ] ConfigMap 热更新生效
- [ ] Job 执行成功
- [ ] CronJob 定时执行
- [ ] PVC 数据持久化
- [ ] 所有 YAML 文件语法正确
- [ ] README 文档完整

## 9. 验证报告模板

```markdown
# K8s 学习沙盒验证报告

**验证时间**: 2026-08-19
**验证人**: [姓名]

## 环境配置
- [x] OrbStack 配置正确
- [x] Docker 环境正常
- [x] 镜像加速生效

## 工具安装
- [x] kubectx / kubens 可用
- [x] kubectl 连接正常

## 核心服务
- [x] Ingress Controller Running
- [x] Dashboard Running
- [x] Demo 应用 Running

## 功能测试
- [x] 滚动更新
- [x] 回滚
- [x] ConfigMap 热更新
- [x] Job/CronJob
- [x] PVC 持久化

## 问题记录
[如有问题，在此记录]

## 结论
[通过/不通过]
```
